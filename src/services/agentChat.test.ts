import { describe, expect, it, vi } from 'vitest';
import { buildCanvasContext, normalizeAgentEndpoint, streamAgentReply } from './agentChat';
import type { TaskNode } from './taskTracker';

describe('normalizeAgentEndpoint', () => {
  it('accepts local OpenAI-compatible endpoints without removing the /v1 path', () => {
    expect(normalizeAgentEndpoint(' http://127.0.0.1:8080/v1/ ')).toBe('http://127.0.0.1:8080/v1');
  });
  it('rejects non-HTTP endpoints and embedded credentials', () => {
    expect(() => normalizeAgentEndpoint('file:///etc/passwd')).toThrow();
    expect(() => normalizeAgentEndpoint('http://user:secret@localhost:8080/v1')).toThrow();
  });
});

describe('buildCanvasContext', () => {
  const notes: TaskNode[] = [
    { id: 'n1', label: 'Fix panel', done: false, children: [], source: { commentId: 'c1', origin: 'canvas', createdAt: 1, text: 'Fix spacing', kind: 'Bug', element: { label: 'Button', selector: '.btn' }, location: { route: '/home' }, projectId: 'p1', screenshot: 'data:image/png;base64,PRIVATE' } },
    { id: 'n2', label: 'Different project', done: false, children: [], source: { commentId: 'c2', origin: 'canvas', createdAt: 2, text: 'Other project', kind: 'Idea', element: { label: 'Other' }, location: {}, projectId: 'p2' } },
  ];
  it('shares the current selection and ordered project comments without silently sending screenshot bytes', () => {
    const result = buildCanvasContext({
      projectId: 'p1', includeSelection: true, includeComments: true,
      selection: { label: 'Save', selector: '#save', rid: 'App.tsx:10:2', styles: { color: 'red' } },
      tasks: notes,
    });
    expect(result).toContain('"label": "Save"');
    expect(result).toContain('Fix spacing');
    expect(result).not.toContain('Other project');
    expect(result).not.toContain('PRIVATE');
  });
  it('excludes selection and notes when those sharing options are disabled', () => {
    const result = buildCanvasContext({ projectId: 'p1', includeSelection: false, includeComments: false, selection: { label: 'Save' }, tasks: notes });
    expect(result).not.toContain('Save');
    expect(result).not.toContain('Fix spacing');
  });
});

describe('streamAgentReply', () => {
  it('streams tokens across arbitrarily split SSE chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel'));
        controller.enqueue(encoder.encode('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const mockFetch = vi.fn(async () => new Response(stream, { status: 200 }));
    const deltas: string[] = [];
    await streamAgentReply(
      { endpoint: 'http://127.0.0.1:8080/v1', model: 'local', apiKey: '' },
      [{ role: 'user', content: 'Hello' }],
      (delta) => deltas.push(delta),
      { fetcher: mockFetch as unknown as typeof fetch },
    );
    expect(deltas.join('')).toBe('Hello world');
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:8080/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
  });
  it('surfaces unsuccessful server responses', async () => {
    const mockFetch = vi.fn(async () => new Response('Model not found', { status: 404 }));
    await expect(streamAgentReply(
      { endpoint: 'http://127.0.0.1:8080/v1', model: 'missing', apiKey: '' },
      [{ role: 'user', content: 'Hello' }], () => undefined,
      { fetcher: mockFetch as unknown as typeof fetch },
    )).rejects.toThrow(/404/);
  });
});
