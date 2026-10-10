import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindowManagerProvider, WindowManagerWorkspace, useWindowManager } from '../../windows/WindowManagerProvider';
import { windowRegistry } from '../../windows/windowRegistry';
import { editorWindowIds } from './editorWindows';

function Probe({ id }: { id: string }) {
  const manager = useWindowManager();
  return <>
    <button type="button" onClick={() => manager.open(id)}>open</button>
    <button type="button" onClick={() => manager.close(id)}>close</button>
  </>;
}

test('registers all seven editor windows', () => {
  expect(editorWindowIds).toEqual(['layers', 'inspector', 'comments', 'production', 'style-lab', 'motion', 'code']);
  for (const id of editorWindowIds) expect(windowRegistry[id]?.InternalContent).toBeDefined();
});

test.each(editorWindowIds)('window %s opens and closes', async (id) => {
  const user = userEvent.setup();
  render(<WindowManagerProvider><WindowManagerWorkspace><Probe id={id} /></WindowManagerWorkspace></WindowManagerProvider>);
  const title = windowRegistry[id].title;
  expect(screen.queryByRole('dialog', { name: title })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'open' }));
  expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'close' }));
  expect(screen.queryByRole('dialog', { name: title })).not.toBeInTheDocument();
});
