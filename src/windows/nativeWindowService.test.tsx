import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, vi } from 'vitest';
import { TitleBar, shouldStartTitleBarDragging } from '../shell/TitleBar';
import { createBrowserNativeWindowService, createNativeWindowService } from './nativeWindowService';

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

test('browser maximize and Escape follow actual fullscreen events', async () => {
  const user = userEvent.setup();
  render(<TitleBar nativeWindowService={createBrowserNativeWindowService()} />);

  await user.click(screen.getByRole('button', { name: 'Maximize window' }));
  vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(document.documentElement);
  fireEvent(document, new Event('fullscreenchange'));
  expect(screen.getByRole('button', { name: 'Restore window' })).toBeInTheDocument();
  vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(null);
  fireEvent(document, new Event('fullscreenchange'));
  expect(screen.getByRole('button', { name: 'Maximize window' })).toBeInTheDocument();
});


test('native maximize state follows Windows resize events and releases the listener', async () => {
  let maximized = true;
  let resize = () => {};
  const unlisten = vi.fn();
  const adapter = {
    minimize: vi.fn(async () => {}), maximize: vi.fn(async () => {}), unmaximize: vi.fn(async () => {}),
    close: vi.fn(async () => {}), startDragging: vi.fn(async () => {}),
    isMaximized: vi.fn(async () => maximized),
    onResized: vi.fn(async (listener: () => void) => { resize = listener; return unlisten; }),
  };
  const { unmount } = render(<TitleBar nativeWindowService={createNativeWindowService(adapter)} />);
  await screen.findByRole('button', { name: 'Restore window' });
  maximized = false;
  await act(async () => resize());
  expect(screen.getByRole('button', { name: 'Maximize window' })).toBeInTheDocument();
  unmount();
  expect(unlisten).toHaveBeenCalledOnce();
});

test('releases a subscription that finishes after the title bar unmounts', async () => {
  let finish!: (stop: () => void) => void;
  const stop = vi.fn();
  const service = { ...createBrowserNativeWindowService(), observeMaximized: () => new Promise<() => void>(resolve => { finish = resolve; }) };
  const { unmount } = render(<TitleBar nativeWindowService={service} />);
  unmount();
  await act(async () => finish(stop));
  expect(stop).toHaveBeenCalledOnce();
});

test('browser mode omits unavailable minimize and close actions', () => {
  render(<TitleBar nativeWindowService={createBrowserNativeWindowService()} />);
  expect(screen.queryByRole('button', { name: 'Minimize window' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close window' })).toBeNull();
});

test('a failed window action shows feedback and leaves maximize state unchanged', async () => {
  render(<TitleBar nativeWindowService={{ ...createBrowserNativeWindowService(), toggleMaximize: vi.fn().mockRejectedValue(new Error('denied')) }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Maximize window' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not resize');
  expect(screen.getByRole('button', { name: 'Maximize window' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss window error' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('double-clicking the drag region maximizes, but inputs do not drag', async () => {
  const toggleMaximize = vi.fn(async () => {});
  render(<TitleBar nativeWindowService={{ ...createBrowserNativeWindowService(), toggleMaximize }} />);
  await userEvent.dblClick(screen.getByTestId('title-bar-drag-region'));
  await waitFor(() => expect(toggleMaximize).toHaveBeenCalledOnce());
  expect(shouldStartTitleBarDragging(document.createElement('input'), 0)).toBe(false);
});
