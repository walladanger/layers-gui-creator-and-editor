import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';

test('collapses navigation and keeps icon labels accessible', async () => {
  const user = userEvent.setup();
  render(<AppShell />);

  await user.click(screen.getByRole('button', { name: /collapse navigation/i }));

  expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');
  expect(screen.getByRole('button', { name: 'Canvas' })).toBeInTheDocument();
});

test('resizing a minimized menu expands the whole menu and saves the width', async () => {
  localStorage.removeItem('layers.navigationWidth');
  const user = userEvent.setup();
  render(<AppShell />);
  await user.click(screen.getByRole('button', { name: /collapse navigation/i }));
  screen.getByRole('separator', { name: 'Resize left menu' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'false');
  expect(localStorage.getItem('layers.navigationWidth')).toBe('240');
  localStorage.removeItem('layers.navigationWidth');
});
