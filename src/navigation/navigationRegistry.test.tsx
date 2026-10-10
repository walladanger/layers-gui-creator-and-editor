import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../shell/AppShell';
import { navigationRegistry } from './navigationRegistry';

const labels = ['Projects', 'Canvas', 'Production', 'Comments', 'Design system', 'Agents', 'Settings', 'About'];

test('the nav renders 8 items in plan order', () => {
  render(<AppShell />);
  const nav = screen.getByRole('navigation');
  expect(navigationRegistry.map((item) => item.label)).toEqual(labels);
  for (const label of labels) expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
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
