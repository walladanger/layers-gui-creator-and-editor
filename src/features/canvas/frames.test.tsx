import { act, render, screen } from '@testing-library/react';
import { clampZoom, zoomAt } from './canvasView';
import { FrameHost } from './FrameHost';
import { breakpointForWidth } from '../../services/services';
import type { Frame, Project } from '../../services/types';

const now = new Date().toISOString();
const project: Project = { id: 'p', created_at: now, updated_at: now, owner_id: 'u', name: 'My app', target_url: 'http://localhost:5173', target_mode: 'live', repo_url: null, framework: null, design_md: null };
const frame: Frame = { id: 'f', created_at: now, updated_at: now, project_id: 'p', route: '/', label: null, width: 1440, height: 900, canvas_x: 0, canvas_y: 0, breakpoint: 'desktop' };
const noop = () => undefined;

test('zoom clamps to 10–400%', () => {
  expect(clampZoom(2)).toBe(10);
  expect(clampZoom(900)).toBe(400);
  expect(zoomAt({ x: 0, y: 0, zoom: 100 }, 1000, 0, 0).zoom).toBe(400);
});

test('breakpoint presets map to §5 breakpoints', () => {
  expect(breakpointForWidth(1440)).toBe('desktop');
  expect(breakpointForWidth(768)).toBe('tablet');
  expect(breakpointForWidth(390)).toBe('mobile');
  expect(breakpointForWidth(900)).toBe('custom');
});

test('FrameHost shows connect card when no ready event within 3 s', () => {
  vi.useFakeTimers();
  render(<FrameHost frame={frame} project={project} onChange={noop} onDuplicate={noop} onDelete={noop} onUseSnapshot={noop} />);
  expect(screen.queryByRole('dialog', { name: 'Connect your app' })).toBeNull();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('dialog', { name: 'Connect your app' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use snapshot mode' })).toBeInTheDocument();
  vi.useRealTimers();
});

test('a ready event from the frame marks it connected', () => {
  render(<FrameHost frame={frame} project={{ ...project, target_mode: 'demo', target_url: '/targets/radium-mock.html' }} onChange={noop} onDuplicate={noop} onDelete={noop} />);
  const iframe = document.querySelector('iframe');
  if (!iframe) throw new Error('Missing frame');
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: { ns: 'radium', v: 1, id: '1', type: 'ready', payload: {} }, source: iframe.contentWindow, origin: window.location.origin })); });
  expect(screen.getByText('Connected')).toBeInTheDocument();
});

test('ignores readiness from a different origin even if the source matches', () => {
  render(<FrameHost frame={frame} project={project} onChange={noop} onDuplicate={noop} onDelete={noop} />);
  const iframe = document.querySelector('iframe'); if (!iframe) throw new Error('Missing frame');
  act(() => window.dispatchEvent(new MessageEvent('message', { origin: 'https://untrusted.example', source: iframe.contentWindow, data: { ns: 'radium', v: 1, id: 'forged', type: 'ready', payload: {} } })));
  expect(screen.getByText('Connecting…')).toBeInTheDocument();
});
