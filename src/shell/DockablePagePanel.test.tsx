import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DockablePagePanel } from './DockablePagePanel';

function Demo() {
  const [docked, setDocked] = useState(true);
  const [width, setWidth] = useState(440);
  return <div className="app-shell__workspace-content" style={{ position: 'relative' }}>
    <output aria-label="Dock width">{width}</output>
    <DockablePagePanel title="Production" docked={docked} onDockChange={setDocked} dockWidth={width}
      onDockWidthChange={setWidth} onClose={() => undefined}>The panel body</DockablePagePanel>
  </div>;
}

test('navigation panel defaults to the left dock and resizes by keyboard', () => {
  render(<Demo />);
  expect(screen.getByRole('region', { name: 'Production' })).toHaveAttribute('data-panel-docked', 'true');
  fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize docked panel' }), { key: 'ArrowRight' });
  expect(screen.getByLabelText('Dock width')).toHaveTextContent('460');
});

test('dragging a navigation panel detaches it, and the dock button returns it to the rail', () => {
  render(<Demo />);
  const header = screen.getByText('Production').closest('header')!;
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 2 });
    fireEvent(header, event);
  };
  pointer('pointerdown', 15, 15);
  pointer('pointermove', 100, 60);
  pointer('pointerup', 100, 60);
  expect(screen.getByRole('region', { name: 'Production' })).toHaveAttribute('data-panel-docked', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Dock panel' }));
  expect(screen.getByRole('region', { name: 'Production' })).toHaveAttribute('data-panel-docked', 'true');
});


function sendPointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 2 });
  fireEvent(target, event);
}

test('dragging far past the workspace keeps the title and close button reachable', () => {
  render(<Demo />);
  const header = screen.getByText('Production').closest('header')!;
  sendPointer(header, 'pointerdown', 15, 15);
  sendPointer(header, 'pointermove', 5000, 5000);
  sendPointer(header, 'pointerup', 5000, 5000);
  const panel = screen.getByRole('region', { name: 'Production' });
  expect(parseFloat(panel.style.left) + parseFloat(panel.style.width)).toBeLessThanOrEqual(window.innerWidth);
  expect(parseFloat(panel.style.top) + parseFloat(panel.style.height)).toBeLessThanOrEqual(window.innerHeight);
});

test('floating panels fit again when the workspace shrinks and support vertical keyboard resize', () => {
  render(<Demo />);
  const header = screen.getByText('Production').closest('header')!;
  sendPointer(header, 'pointerdown', 15, 15);
  sendPointer(header, 'pointermove', 100, 60);
  sendPointer(header, 'pointerup', 100, 60);
  const panel = screen.getByRole('region', { name: 'Production' });
  const oldHeight = parseFloat(panel.style.height);
  fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize panel' }), { key: 'ArrowUp' });
  expect(parseFloat(panel.style.height)).toBe(oldHeight - 20);
  const rect = vi.spyOn(panel.closest('.app-shell__workspace-content')!, 'getBoundingClientRect')
    .mockReturnValue({ width: 280, height: 180 } as DOMRect);
  fireEvent(window, new Event('resize'));
  expect(panel).toHaveStyle({ left: '0px', top: '0px', width: '280px', height: '180px' });
  rect.mockRestore();
});
