import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '../settings/settingsStore';
import { createMemorySettingsAdapter, createSettingsService, defaultSettings } from '../settings/settingsService';

test('renders the full-height navigation and custom title-bar actions', () => {
  render(<AppShell />);

  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /minimize/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /maximize/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
});

test('uses generic settings for the initial and updated navigation collapse state', async () => {
  const user = userEvent.setup();
  const service = createSettingsService(createMemorySettingsAdapter());
  render(
    <SettingsProvider service={service} initialSettings={{ ...defaultSettings, navigationCollapsed: true }}>
      <AppShell />
    </SettingsProvider>,
  );

  expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');
  await user.click(screen.getByRole('button', { name: /expand navigation/i }));
  await expect(service.load()).resolves.toMatchObject({ navigationCollapsed: false });
});

test('navigation pages dock next to the left rail and leave the right-side canvas visible', async () => {
  const user = userEvent.setup();
  render(<AppShell renderRoute={route => <span>Content: {route}</span>} />);
  await user.click(screen.getByRole('button', { name: 'Production' }));
  const workspace = screen.getByRole('main').querySelector('.app-shell__workspace-content');
  expect(workspace).toHaveAttribute('data-docked', 'true');
  expect(workspace?.querySelector('.app-shell__canvas-layer')).toHaveTextContent('Content: canvas');
  expect(workspace?.querySelector('.app-shell__page-layer')).toHaveAttribute('data-side', 'left');
  expect(workspace?.querySelector('.app-shell__page-panel')).toHaveTextContent('Content: production');
  await user.click(screen.getByRole('button', { name: 'Agents' }));
  expect(workspace?.querySelector('.app-shell__page-panel')).toHaveTextContent('Content: agents');
  await user.click(screen.getByRole('button', { name: 'Close page' }));
  expect(workspace).toHaveAttribute('data-docked', 'false');
});
