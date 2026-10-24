import { act, fireEvent, render, screen } from '@testing-library/react';
import { HELP } from './helpContent';
import { HelpProvider } from './HelpProvider';

test('every help entry has a tip, a title and a verbose body', () => {
  for (const [key, entry] of Object.entries(HELP)) {
    expect(entry.tip.length, `${key} tip`).toBeGreaterThan(4);
    expect(entry.title.length, `${key} title`).toBeGreaterThan(2);
    expect(entry.body.length, `${key} body`).toBeGreaterThan(entry.tip.length);
  }
});

test('hovering a menu button shows a tooltip card and a hover-only ask button', () => {
  vi.useFakeTimers();
  render(<>
    <button type="button" data-help="nav.production" data-help-ask>Production</button>
    <HelpProvider />
  </>);
  const button = screen.getByRole('button', { name: 'Production' });
  fireEvent.mouseOver(button);
  // The ask button appears straight away; the tip card waits for a short hover.
  expect(screen.getByRole('button', { name: 'More about Production' })).toBeInTheDocument();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(400); });
  expect(screen.getByRole('tooltip')).toHaveTextContent(HELP['nav.production'].tip);
  vi.useRealTimers();
});

test('the ask button opens a verbose panel and Escape closes it', () => {
  render(<>
    <button type="button" data-help="gui.edges" data-help-ask>Corners and edges</button>
    <HelpProvider />
  </>);
  fireEvent.mouseOver(screen.getByRole('button', { name: 'Corners and edges' }));
  fireEvent.click(screen.getByRole('button', { name: 'More about Corners and edges' }));
  const panel = screen.getByRole('dialog', { name: 'Corners and edges' });
  expect(panel).toHaveTextContent(HELP['gui.edges'].body);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Corners and edges' })).not.toBeInTheDocument();
});

test('buttons without data-help-ask get a tooltip but no ask button', () => {
  render(<>
    <button type="button" data-help="canvas.fit">Fit</button>
    <HelpProvider />
  </>);
  fireEvent.mouseOver(screen.getByRole('button', { name: 'Fit' }));
  expect(screen.queryByRole('button', { name: /More about/ })).not.toBeInTheDocument();
});
