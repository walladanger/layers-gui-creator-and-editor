import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../shell/AppShell';
import { navigationRegistry } from './navigationRegistry';

const labels = ['Projects', 'Production', 'Comments', 'Agents', 'Settings', 'About'];

test('the nav keeps every destination with Production before its children and no canvas button', () => {
  render(<AppShell />);
  const nav = screen.getByRole('navigation');
  expect(navigationRegistry.map((item) => item.label)).toEqual(labels);
  for (const label of labels) expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
  expect(within(nav).queryByRole('button', { name: 'Canvas' })).not.toBeInTheDocument();
});

test.each(['comments'])('%s belongs to Production', (id) => {
  expect(navigationRegistry.find((item) => item.id === id)?.parentId).toBe('production');
});

test('Production opens its own page and its child pages remain accessible after expanding', async () => {
  const user = userEvent.setup();
  const { container } = render(<AppShell />);
  await user.click(screen.getByRole('button', { name: 'Collapse Production' }));
  expect(screen.queryByRole('button', { name: 'Comments' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Production' }));
  expect(container.querySelector('.app-shell__workspace-content')).toHaveAttribute('data-route', 'production');
  await user.click(screen.getByRole('button', { name: 'Comments' }));
  expect(container.querySelector('.app-shell__workspace-content')).toHaveAttribute('data-route', 'comments');
});

test('clicking each nav item routes to its page', async () => {
  const user = userEvent.setup();
  const { container } = render(<AppShell />);
  for (const item of navigationRegistry) {
    await user.click(screen.getByRole('button', { name: item.label }));
    expect(screen.getByRole('button', { name: item.label })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector('.app-shell__workspace-content')).toHaveAttribute('data-route', item.route);
  }
});

test('the canvas stays viewable while another page is open and closes back to it', async () => {
  const user = userEvent.setup();
  const { container } = render(<AppShell />);
  await user.click(screen.getByRole('button', { name: 'Production' }));
  expect(screen.getByRole('region', { name: 'Canvas' })).toBeInTheDocument();
  expect(container.querySelector('.app-shell__canvas-layer')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Production' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close page' }));
  expect(screen.queryByRole('heading', { name: 'Production' })).not.toBeInTheDocument();
  expect(container.querySelector('.app-shell__workspace-content')).toHaveAttribute('data-route', 'canvas');
});
