import { flattenTasks, type TaskNode } from './taskTracker';

export interface AgentConnection {
  endpoint: string;
  model: string;
  /** Session-only. Never persist credentials in the canvas settings or localStorage. */
  apiKey: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CanvasAgentSelection {
  frameId?: string;
  label?: string;
  selector?: string;
  rid?: string;
  comp?: string;
  text?: string;
  styles?: Record<string, string>;
}

export interface CanvasContextInput {
  projectId: string | null;
  includeComments: boolean;
  selection: CanvasAgentSelection | null;
  tasks: TaskNode[];
}

export function shareableSelection(snapshot: {
  connected: boolean; busy: boolean; frameId: string | null; projectId: string | null;
  node: CanvasAgentSelection | null; values: Record<string, string>;
}, currentProjectId: string | null): CanvasAgentSelection | null {
  if (!currentProjectId || !snapshot.connected || snapshot.busy ||
      snapshot.projectId !== currentProjectId || !snapshot.frameId || !snapshot.node) return null;
  return { ...snapshot.node, frameId: snapshot.frameId, styles: snapshot.values };
}

/** Share the current Grab selection and only opted-in comments from the open project. */
export function buildCanvasContext(input: CanvasContextInput): string {
  const result: Record<string, unknown> = { projectId: input.projectId };
  if (input.projectId && input.selection) {
    const { frameId, label, selector, rid, comp, text, styles } = input.selection;
    result.selectedElement = { frameId, label, selector, rid, comp, text: text?.slice(0, 1200), styles };
  }
  if (input.includeComments && input.projectId) {
    result.productionComments = flattenTasks(input.tasks)
      .filter((task) => task.source?.projectId === input.projectId)
      .slice(0, 50)
      .map((task) => {
        const source = task.source!;
        return {
          commentId: source.commentId,
          kind: source.kind,
          status: task.status ?? (task.done ? 'done' : 'todo'),
          text: source.text.slice(0, 2000),
          element: source.element,
          location: source.location,
          createdAt: source.createdAt,
          hasScreenshot: Boolean(source.screenshot || source.fullShots),
        };
      });
  }
  return JSON.stringify(result, null, 2);
}

/** The caller supplies the OpenAI-compatible API root, such as localhost:8080/v1. */
export function normalizeAgentEndpoint(input: string): string {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an http(s) API address without credentials, query, or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

function route(endpoint: string, path: string): string {
  return `${normalizeAgentEndpoint(endpoint)}/${path}`;
}

function headers(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}

/** A connection probe does not send canvas data or previous chat messages. */
export async function probeAgentConnection(connection: AgentConnection, options: { fetcher?: typeof fetch; signal?: AbortSignal } = {}): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(route(connection.endpoint, 'models'), {
    headers: headers(connection.apiKey), signal: options.signal,
  });
  if (!response.ok) throw new Error(`Agent server replied ${response.status}. Check the address, credentials and CORS settings.`);
}

export async function streamAgentReply(
  connection: AgentConnection,
  messages: AgentMessage[],
  onDelta: (delta: string) => void,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  if (!connection.model.trim()) throw new Error('Enter a model ID before sending a message.');
  const response = await fetcher(route(connection.endpoint, 'chat/completions'), {
    method: 'POST',
    headers: headers(connection.apiKey),
    body: JSON.stringify({ model: connection.model.trim(), stream: true, messages }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Agent server replied ${response.status}. Verify the model ID and connection settings.`);
  if (!response.body) throw new Error('This agent server did not provide a streaming response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const receiveEvent = (event: string): boolean => {
    const data = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n').trim();
    if (data === '[DONE]') return true;
    if (!data) return false;
    let payload: { choices?: { delta?: { content?: unknown } }[]; error?: { message?: string } };
    try { payload = JSON.parse(data) as typeof payload; }
    catch { throw new Error('The agent sent an invalid streaming event.'); }
    if (payload.error) throw new Error(payload.error.message ?? 'The agent reported an error.');
    const delta = payload.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') onDelta(delta);
    return false;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        pending += decoder.decode();
        break;
      }
      pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = pending.indexOf('\n\n');
      while (boundary >= 0) {
        const event = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (receiveEvent(event)) return;
        boundary = pending.indexOf('\n\n');
      }
    }
    if (pending.trim()) receiveEvent(pending);
  } finally {
    reader.releaseLock();
  }
}
