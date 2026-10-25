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
  expect(screen.getByRole('complementary', { name: 'Effect menu' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Canvas' })).toHaveTextContent('No frames yet');
  expect(screen.queryByRole('complementary', { name: 'Side panel' })).not.toBeInTheDocument();
});

test('style and motion menus remain available inside their category folders', async () => {
  renderCanvas();
  const user = userEvent.setup();
  expect(screen.getByRole('button', { name: 'GUI Editor' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('button', { name: 'Saved looks' })).not.toBeInTheDocument();
  for (const name of ['Colours and appearance', 'Layout and text', 'Motion', 'Notes and export']) {
    await user.click(screen.getByRole('button', { name }));
  }
  for (const name of ['Editing tools', 'Edit tools', 'Selected item', 'Try it', 'Reset to original']) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  const names = ['Presets', 'Corners and edges', 'Depth and glow', 'Spacing and text', 'Colour', 'Status greens', 'Background gradient', 'Page-change burst', 'Card size and theme', 'Your settings as CSS', 'Edge chase', 'Glow pulse', 'Warp', 'Ripple', 'Shimmer', 'Pop', 'Shake', 'Float', 'Border draw', 'Blur-in entrance'];
  const icons = names.map(name => {
    const button = screen.getByRole('button', { name });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    return button.querySelector('svg')?.getAttribute('class');
  });
  expect(new Set(icons).size).toBe(names.length);
});

test('the layout persists through the settings service', async () => {
  const user = userEvent.setup();
  const service = renderCanvas();
  await user.click(screen.getByRole('button', { name: 'Hide layers' }));
  const saved = await service.load();
  expect(saved.extensionSettings[CANVAS_LAYOUT_KEY]).toEqual({ ...defaultCanvasLayout, leftRailOpen: false });
});

test('a saved layout is restored on load', () => {
  renderCanvas(undefined, { ...defaultSettings, extensionSettings: { [CANVAS_LAYOUT_KEY]: { ...defaultCanvasLayout, rightTab: 'comments', rightRailOpen: true, leftRailOpen: false } } });
  expect(screen.queryByRole('complementary', { name: 'Side panel' })).not.toBeInTheDocument();
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
  await user.click(screen.getByRole('button', { name: 'Reset layout' }));
  expect(screen.queryByRole('dialog', { name: 'Layers' })).not.toBeInTheDocument();

  expect((await service.load()).extensionSettings[CANVAS_LAYOUT_KEY]).toEqual(defaultCanvasLayout);
});
