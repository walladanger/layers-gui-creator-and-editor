import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindowManagerProvider, WindowManagerWorkspace } from '../../windows/WindowManagerProvider';
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
  expect(screen.getByRole('dialog', { name: 'Agent connection' })).toHaveAttribute('aria-hidden', 'true');
  await user.click(button);
  expect(screen.getByRole('dialog', { name: 'Agent connection' })).not.toHaveAttribute('aria-hidden', 'true');
});
