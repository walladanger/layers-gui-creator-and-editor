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
  fireEvent.pointerDown(header, { button: 0, pointerId: 2, clientX: 15, clientY: 15 });
  fireEvent.pointerMove(header, { pointerId: 2, clientX: 100, clientY: 60 });
  fireEvent.pointerUp(header, { pointerId: 2 });
  expect(screen.getByRole('region', { name: 'Production' })).toHaveAttribute('data-panel-docked', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Dock panel' }));
  expect(screen.getByRole('region', { name: 'Production' })).toHaveAttribute('data-panel-docked', 'true');
});
