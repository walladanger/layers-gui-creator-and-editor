import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, vi } from 'vitest';
import { TitleBar, shouldStartTitleBarDragging } from '../shell/TitleBar';
import { createBrowserNativeWindowService } from './nativeWindowService';

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

test('browser maximize requests fullscreen for the entire workspace', async () => {
  const request = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(document.documentElement, 'requestFullscreen').mockImplementation(request);
  await createBrowserNativeWindowService().toggleMaximize();
  expect(request).toHaveBeenCalledOnce();
});

test('browser restore exits fullscreen', async () => {
  vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(document.documentElement);
  const exit = vi.spyOn(document, 'exitFullscreen').mockResolvedValue(undefined);
  await createBrowserNativeWindowService().toggleMaximize();
  expect(exit).toHaveBeenCalledOnce();
});

test('a blocked fullscreen request opens the workspace without the preview frame', async () => {
  vi.spyOn(document.documentElement, 'requestFullscreen').mockRejectedValue(new Error('Blocked'));
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  await createBrowserNativeWindowService().toggleMaximize();
  expect(open).toHaveBeenCalledWith(window.location.href, '_blank', 'noopener,noreferrer');
});

test('browser native-window fallback resolves every title-bar operation', async () => {
  const service = createBrowserNativeWindowService();

  await expect(service.minimize()).resolves.toBeUndefined();
  await expect(service.toggleMaximize()).resolves.toBeUndefined();
  await expect(service.close()).resolves.toBeUndefined();
  await expect(service.startDragging()).resolves.toBeUndefined();
});

test('title-bar actions and drag behavior use the injected native-window service', async () => {
  const user = userEvent.setup();
  const service = {
    minimize: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
  };
  render(<TitleBar nativeWindowService={service} />);

  await user.click(screen.getByRole('button', { name: 'Minimize window' }));
  await user.click(screen.getByRole('button', { name: 'Maximize window' }));
  await user.click(screen.getByRole('button', { name: 'Close window' }));
  await user.pointer({ target: screen.getByTestId('title-bar-drag-region'), keys: '[MouseLeft]' });

  expect(service.minimize).toHaveBeenCalledOnce();
  expect(service.toggleMaximize).toHaveBeenCalledOnce();
  expect(service.close).toHaveBeenCalledOnce();
  expect(service.startDragging).toHaveBeenCalledOnce();
});

test('does not start dragging from a nested SVG inside a window action', () => {
  const button = document.createElement('button');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  button.append(svg);

  expect(shouldStartTitleBarDragging(svg, 0)).toBe(false);
});

test('labels the controlled maximized action as Restore', () => {
  render(<TitleBar isMaximized nativeWindowService={createBrowserNativeWindowService()} />);

  expect(screen.getByRole('button', { name: 'Restore window' })).toBeInTheDocument();
});

test('switches the uncontrolled maximize action to Restore after toggling', async () => {
  const user = userEvent.setup();
  render(<TitleBar nativeWindowService={createBrowserNativeWindowService()} />);

  await user.click(screen.getByRole('button', { name: 'Maximize window' }));
  expect(screen.getByRole('button', { name: 'Restore window' })).toBeInTheDocument();
});
