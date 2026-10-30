import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindowManagerProvider, WindowManagerWorkspace } from '../../windows/WindowManagerProvider';
import { canvasProjectContext } from '../../services/canvasProjectContext';
import { liveStyleService } from '../../services/liveStyleService';
import type { BridgeService, BridgeNode } from '../../services/bridgeService';
import type { Frame } from '../../services/types';
import { ToolPill } from './ToolPill';

test('the floating canvas toolbar opens and minimizes the agent connection window', async () => {
  const user = userEvent.setup();
  render(
    <WindowManagerProvider>
      <WindowManagerWorkspace>
        <ToolPill tool="use" onTool={() => undefined} showPins onTogglePins={() => undefined}
          notesOpen={false} onToggleNotes={() => undefined} openCount={0} />
      </WindowManagerWorkspace>
    </WindowManagerProvider>,
  );
  const button = screen.getByRole('button', { name: 'Agent' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  await user.click(button);
  expect(await screen.findByRole('dialog', { name: 'Agent connection' })).toBeInTheDocument();
  expect(button).toHaveAttribute('aria-pressed', 'true');
  await user.click(button);
  expect(document.querySelector('.internal-window[data-window-state="minimized"]')).toHaveAttribute('aria-hidden', 'true');
  await user.click(button);
  expect(screen.getByRole('dialog', { name: 'Agent connection' })).not.toHaveAttribute('aria-hidden', 'true');
});

test('Grab reveals a one-click Ask Agent action without opening chat automatically', async () => {
  const bridge = { subscribe: () => () => undefined, request: async () => ({ computed: { color: 'red' }, inline: {}, classList: [] }) } as unknown as BridgeService;
  const frame = { id: 'f1', project_id: 'p1' } as Frame;
  const node = { nid: 'n1', label: 'Save', selector: '#save' } as BridgeNode;
  canvasProjectContext.setProject('p1');
  const detach = liveStyleService.attach('f1', bridge, frame);
  const user = userEvent.setup();
  try {
    render(<WindowManagerProvider><WindowManagerWorkspace>
      <ToolPill tool="grab" onTool={() => undefined} showPins onTogglePins={() => undefined}
        notesOpen={false} onToggleNotes={() => undefined} openCount={0} />
    </WindowManagerWorkspace></WindowManagerProvider>);
    expect(screen.queryByRole('button', { name: 'Ask Agent' })).not.toBeInTheDocument();
    await act(async () => { await liveStyleService.select('f1', node); });
    const ask = await screen.findByRole('button', { name: 'Ask Agent' });
    expect(screen.queryByRole('dialog', { name: 'Agent connection' })).not.toBeInTheDocument();
    await user.click(ask);
    expect(await screen.findByRole('dialog', { name: 'Agent connection' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Agent model ID' })).toHaveFocus());
    act(() => canvasProjectContext.setProject('p2'));
    expect(screen.queryByRole('button', { name: 'Ask Agent' })).not.toBeInTheDocument();
  } finally {
    detach();
    canvasProjectContext.setProject(null);
  }
});
