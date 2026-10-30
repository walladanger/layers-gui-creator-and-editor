import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemorySource } from '../../services/projectSource';
import { saveScreenSnapshot } from '../../services/screenSnapshots';
import { onOpenScreen } from './catalogBus';
import { ScreenCatalogWindow } from './ScreenCatalogWindow';

test('selecting real snapshot thumbnails opens the matching screen and route', async () => {
  const source = createMemorySource('thumbnail-test', [
    { path: 'public/one.html', content: '<title>One</title>' },
    { path: 'public/two.html', content: '<title>Two</title>' },
  ]);
  const listener = vi.fn();
  const detach = onOpenScreen(listener);
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={source} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  await screen.findByRole('button', { name: 'Open One' });
  act(() => {
    saveScreenSnapshot('thumbnail-test', 'public/one.html', 'data:image/png;base64,b25l');
    saveScreenSnapshot('thumbnail-test', 'public/two.html', 'data:image/png;base64,dHdv');
  });
  await user.click(screen.getByRole('img', { name: 'Two snapshot' }));
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
    sourceKey: 'thumbnail-test', screen: expect.objectContaining({ id: 'public/two.html', route: '/two.html' }),
  }));
  await user.click(screen.getByRole('img', { name: 'One snapshot' }));
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
    screen: expect.objectContaining({ id: 'public/one.html', route: '/one.html' }),
  }));
  detach();
});
test('the application import panel has only folder and GitHub as primary choices, with no server address prompt', () => {
  render(<ScreenCatalogWindow />);
  expect(screen.getByRole('button', { name: /Select Folder/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /GitHub Project/i })).toBeInTheDocument();
  expect(screen.queryByLabelText('App address')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Demo' })).not.toBeInTheDocument();
});
