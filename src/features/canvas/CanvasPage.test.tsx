import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '../../settings/settingsStore';
import { createMemorySettingsAdapter, createSettingsService, defaultSettings } from '../../settings/settingsService';
import { WindowManagerProvider, WindowManagerWorkspace } from '../../windows/WindowManagerProvider';
import { CanvasPage } from './CanvasPage';
import { CANVAS_LAYOUT_KEY, defaultCanvasLayout, readCanvasLayout } from './canvasLayout';

function renderCanvas(service = createSettingsService(createMemorySettingsAdapter()), initialSettings = defaultSettings) {
  render(
    <SettingsProvider service={service} initialSettings={initialSettings}>
      <WindowManagerProvider><WindowManagerWorkspace><CanvasPage /></WindowManagerWorkspace></WindowManagerProvider>
    </SettingsProvider>,
  );
  return service;
}

test('shows every region with an empty state', () => {
  renderCanvas();
  const toolbar = screen.getByRole('toolbar', { name: 'Canvas tools' });
  for (const tool of ['Grab', 'Comment', 'Draw', 'Insert', 'Hand']) expect(screen.getByRole('button', { name: tool })).toBeInTheDocument();
  expect(toolbar).toContainElement(screen.getByLabelText('Zoom level'));
  expect(screen.getByLabelText('Zoom level')).toHaveTextContent('100%');
  expect(screen.getByRole('complementary', { name: 'Layers' })).toHaveTextContent('No layers yet');
  expect(screen.getByRole('region', { name: 'Canvas' })).toHaveTextContent('No frames yet');
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Inspector', 'Comments', 'Production']);
});

test('the layout persists through the settings service', async () => {
  const user = userEvent.setup();
  const service = renderCanvas();
  await user.click(screen.getByRole('tab', { name: 'Production' }));
  await user.click(screen.getByRole('button', { name: 'Hide layers' }));
  const saved = await service.load();
  expect(saved.extensionSettings[CANVAS_LAYOUT_KEY]).toEqual({ ...defaultCanvasLayout, rightTab: 'production', leftRailOpen: false });
});

test('a saved layout is restored on load', () => {
  renderCanvas(undefined, { ...defaultSettings, extensionSettings: { [CANVAS_LAYOUT_KEY]: { ...defaultCanvasLayout, rightTab: 'comments', rightRailOpen: true, leftRailOpen: false } } });
  expect(screen.getByRole('tab', { name: 'Comments' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('complementary', { name: 'Layers' })).not.toBeInTheDocument();
});

test('invalid saved layouts fall back to the default', () => {
  expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: { version: 2 } })).toEqual(defaultCanvasLayout);
});

test('Reset layout restores rails and closes open windows', async () => {
  const user = userEvent.setup();
  const service = renderCanvas();
  await user.click(screen.getByRole('button', { name: 'Open Layers window' }));
  expect(screen.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Comments' }));
  await user.click(screen.getByRole('button', { name: 'Reset layout' }));
  expect(screen.queryByRole('dialog', { name: 'Layers' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Inspector' })).toHaveAttribute('aria-selected', 'true');
  expect((await service.load()).extensionSettings[CANVAS_LAYOUT_KEY]).toEqual(defaultCanvasLayout);
});
