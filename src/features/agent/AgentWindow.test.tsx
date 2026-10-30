import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { BridgeNode, BridgeService } from '../../services/bridgeService';
import { canvasProjectContext } from '../../services/canvasProjectContext';
import { liveStyleService } from '../../services/liveStyleService';
import type { Frame } from '../../services/types';
import AgentWindow from './AgentWindow';

afterEach(() => {
  canvasProjectContext.setProject(null);
  vi.unstubAllGlobals();
});

test('a Grab selection and styles go with the next chat message without a sharing toggle', async () => {
  const requests: { url: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    requests.push({ url, body: options?.body as string | undefined });
    return new Response(url.endsWith('/models') ? '{}' : 'data: [DONE]\n\n', { status: 200 });
  }));
  const bridge = { subscribe: () => () => undefined, request: async () => ({ computed: { color: 'red', 'font-size': '16px' }, inline: {}, classList: [] }) } as unknown as BridgeService;
  const frame = { id: 'f1', project_id: 'p1' } as Frame;
  const node = { nid: 'n1', label: 'Save button', selector: '#save' } as BridgeNode;
  const detach = liveStyleService.attach('f1', bridge, frame);
  try {
    act(() => canvasProjectContext.setProject('p1'));
    await liveStyleService.select('f1', node);
    const user = userEvent.setup();
    render(<AgentWindow />);
    expect(screen.queryByRole('checkbox', { name: 'Share selected canvas element' })).not.toBeInTheDocument();
    expect(screen.getByText(/Save button · styles attached/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Agent model ID' }), 'local-model');
    await user.click(screen.getByRole('button', { name: 'Connect agent' }));
    await screen.findByText('Agent connected');
    await user.type(screen.getByRole('textbox', { name: 'Message agent' }), 'How should this look?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(requests.some(request => request.url.endsWith('/chat/completions'))).toBe(true));
    const sent = JSON.parse(requests.find(request => request.url.endsWith('/chat/completions'))!.body!) as { messages: { content: string }[] };
    expect(sent.messages[1].content).toContain('"label": "Save button"');
    expect(sent.messages[1].content).toContain('"font-size": "16px"');
    expect(screen.getByText('Selected element: Save button')).toBeInTheDocument();
    act(() => canvasProjectContext.setProject('p2'));
    await waitFor(() => expect(screen.queryByText('Selected element: Save button')).not.toBeInTheDocument());
    expect(screen.getByText(/Grab an element to attach/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message agent' }), 'What is on this project?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(requests.filter(request => request.url.endsWith('/chat/completions'))).toHaveLength(2));
    const second = JSON.parse(requests.filter(request => request.url.endsWith('/chat/completions'))[1].body!) as { messages: { content: string }[] };
    expect(second.messages.map(message => message.content).join('\n')).not.toContain('Save button');
    expect(second.messages[1].content).toContain('"projectId": "p2"');
  } finally {
    detach();
  }
});
