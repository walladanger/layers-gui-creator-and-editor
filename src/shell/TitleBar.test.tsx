import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLOATING_KEY, TitleBar } from './TitleBar';
import type { NativeWindowService } from '../windows/nativeWindowService';

const base = (): NativeWindowService => ({ minimize: vi.fn(async () => undefined), toggleMaximize: vi.fn(async () => undefined), close: vi.fn(async () => undefined), startDragging: vi.fn(async () => undefined) });

afterEach(() => localStorage.removeItem(FLOATING_KEY));

test('the browser build has no float button, because a web page cannot stay above other windows', () => {
  render(<TitleBar nativeWindowService={base()} />);
  expect(screen.queryByRole('button', { name: 'Float on top' })).toBeNull();
});

test('the desktop app floats on top and remembers it for next time', async () => {
  const setAlwaysOnTop = vi.fn(async () => undefined);
  const { unmount } = render(<TitleBar nativeWindowService={{ ...base(), setAlwaysOnTop }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Float on top' }));
  expect(setAlwaysOnTop).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Stop floating' })).toHaveAttribute('aria-pressed', 'true');
  expect(localStorage.getItem(FLOATING_KEY)).toBe('1');
  unmount();
  setAlwaysOnTop.mockClear();
  render(<TitleBar nativeWindowService={{ ...base(), setAlwaysOnTop }} />);
  expect(setAlwaysOnTop).toHaveBeenCalledWith(true);
});
