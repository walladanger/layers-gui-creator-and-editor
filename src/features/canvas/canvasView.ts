export const ZOOM_MIN = 10;
export const ZOOM_MAX = 400;

export interface CanvasView { x: number; y: number; zoom: number }

export function clampZoom(zoom: number) {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)));
}

/** Zoom around a screen point so the content under the cursor stays put. */
export function zoomAt(view: CanvasView, nextZoom: number, px: number, py: number): CanvasView {
  const zoom = clampZoom(nextZoom);
  const k = zoom / view.zoom;
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

export interface Box { x: number; y: number; width: number; height: number }

/** Fit every frame inside the viewport with padding. */
export function fitView(frames: Box[], viewport: { width: number; height: number }, padding = 48): CanvasView {
  if (frames.length === 0 || viewport.width <= 0) return { x: padding, y: padding, zoom: 100 };
  const minX = Math.min(...frames.map((f) => f.x));
  const minY = Math.min(...frames.map((f) => f.y));
  const maxX = Math.max(...frames.map((f) => f.x + f.width));
  const maxY = Math.max(...frames.map((f) => f.y + f.height));
  const scale = Math.min((viewport.width - padding * 2) / (maxX - minX), (viewport.height - padding * 2) / (maxY - minY));
  const zoom = clampZoom(scale * 100);
  const k = zoom / 100;
  return { zoom, x: (viewport.width - (maxX - minX) * k) / 2 - minX * k, y: padding - minY * k };
}
