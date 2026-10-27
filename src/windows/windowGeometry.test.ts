import { describe, expect, it } from 'vitest';
import { clampBounds, clampResizeBounds, bringToFront, reachableHeaderWidth } from './windowGeometry';

describe('windowGeometry', () => {
  const workspace = { width: 1000, height: 800 };
  const minimum = { width: 200, height: 150 };

  describe('clampBounds', () => {
    it('returns bounds unchanged if within workspace', () => {
      const bounds = { x: 100, y: 100, width: 300, height: 200 };
      expect(clampBounds(bounds, workspace, minimum)).toEqual(bounds);
    });

    it('enforces minimum dimensions', () => {
      const bounds = { x: 100, y: 100, width: 100, height: 100 }; // smaller than minimum
      expect(clampBounds(bounds, workspace, minimum)).toEqual({
        x: 100,
        y: 100,
        width: 200,
        height: 150,
      });
    });

    it('enforces maximum dimensions bounded by workspace', () => {
      const bounds = { x: 100, y: 100, width: 1200, height: 1000 };
      expect(clampBounds(bounds, workspace, minimum)).toEqual({
        x: 100,
        y: 100,
        width: 1000,
        height: 800,
      });
    });

    it('prevents window from moving completely off-screen left/top', () => {
      const bounds = { x: -500, y: -100, width: 300, height: 200 };
      const expectedX = -300 + reachableHeaderWidth; // -300 + 96 = -204
      expect(clampBounds(bounds, workspace, minimum)).toEqual({
        x: expectedX,
        y: 0,
        width: 300,
        height: 200,
      });
    });

    it('prevents window from moving completely off-screen right/bottom', () => {
      const bounds = { x: 1500, y: 900, width: 300, height: 200 };
      const expectedX = workspace.width - reachableHeaderWidth; // 1000 - 96 = 904
      const expectedY = workspace.height - 38; // 800 - 38 = 762
      expect(clampBounds(bounds, workspace, minimum)).toEqual({
        x: expectedX,
        y: expectedY,
        width: 300,
        height: 200,
      });
    });
  });

  describe('clampResizeBounds', () => {
    it('acts like clampBounds if no edge is provided', () => {
      const bounds = { x: -500, y: -100, width: 300, height: 200 };
      expect(clampResizeBounds(bounds, workspace, minimum)).toEqual(
        clampBounds(bounds, workspace, minimum)
      );
    });

    it('anchors left edge when resizing east', () => {
      // original: x=100, width=1200 => resize past workspace width
      const bounds = { x: 100, y: 100, width: 1200, height: 200 };
      expect(clampResizeBounds(bounds, workspace, minimum, 'east')).toEqual({
        x: 100,
        y: 100,
        width: 1000, // clamped to workspace width
        height: 200,
      });
    });

    it('anchors right edge when resizing west', () => {
      // original right edge: 300
      // resize left edge to -50, making width 350
      const bounds = { x: -50, y: 100, width: 350, height: 200 };
      const result = clampResizeBounds(bounds, workspace, minimum, 'west');
      expect(result).toEqual({
        x: -50,
        y: 100,
        width: 350,
        height: 200,
      });
      expect(result.x + result.width).toBe(300); // Right edge maintained
    });

    it('anchors bottom edge when resizing north', () => {
      // original bottom edge: 300 (y=100, h=200)
      // resize top edge to -10, making height 310
      const bounds = { x: 100, y: -10, width: 300, height: 310 };
      const result = clampResizeBounds(bounds, workspace, minimum, 'north');

      // Because minimumY is 0, y gets clamped to 0.
      // We expect the bottom edge to remain 300, so height becomes 300.
      expect(result).toEqual({
        x: 100,
        y: 0,
        width: 300,
        height: 300,
      });
      expect(result.y + result.height).toBe(300); // Bottom edge maintained
    });

    it('adjusts width correctly when resizing west pushes past left bound', () => {
      // original right edge: 50. Drag west out of bounds to x = -950, new width = 1000
      const bounds = { x: -950, y: 100, width: 1000, height: 200 };
      const result = clampResizeBounds(bounds, workspace, minimum, 'west');

      // When dragging west, the window width reaches max width (workspace.width = 1000).
      // Then x is clamped to minimumX = -1000 + 96 = -904.
      // The bug fix compensates the width by the clamped difference (46px) so the right edge remains anchored at 50.
      expect(result).toEqual({
        x: -904,
        y: 100,
        width: 954,
        height: 200,
      });
      expect(result.x + result.width).toBe(50);
    });

    it('adjusts height correctly when resizing north pushes past top bound', () => {
      // original bottom edge: 200. Drag north out of bounds to y = -50, new height = 250
      const bounds = { x: 100, y: -50, width: 200, height: 250 };
      const result = clampResizeBounds(bounds, workspace, minimum, 'north');

      // When dragging north, y is clamped to minimumY = 0.
      // The bug fix compensates the height by the clamped difference (50px) so the bottom edge remains anchored at 200.
      expect(result).toEqual({
        x: 100,
        y: 0,
        width: 200,
        height: 200,
      });
      expect(result.y + result.height).toBe(200);
    });

    it('anchors top edge when resizing south', () => {
      // original top edge: 100
      // resize bottom edge to 1000, making height 900
      const bounds = { x: 100, y: 100, width: 300, height: 900 };
      const result = clampResizeBounds(bounds, workspace, minimum, 'south');
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 300,
        height: 800, // workspace max height
      });
    });

    it('anchors correct edges for diagonal resizing', () => {
      const bounds = { x: -50, y: -50, width: 350, height: 350 };
      // resizing north-west
      const result = clampResizeBounds(bounds, workspace, minimum, 'north-west');
      // minimumY is 0, so y gets clamped to 0.
      // original bottom was 300 (-50+350). So new height should be 300.
      // x is -50, which is valid.
      expect(result).toEqual({
        x: -50,
        y: 0,
        width: 350,
        height: 300,
      });
    });
  });

  describe('bringToFront', () => {
    it('brings specified window to front by incrementing its zIndex to max + 1', () => {
      const windows = [
        { id: 'w1', zIndex: 1 },
        { id: 'w2', zIndex: 5 },
        { id: 'w3', zIndex: 2 },
      ];

      const result = bringToFront(windows, 'w1');

      expect(result).toEqual([
        { id: 'w1', zIndex: 6 },
        { id: 'w2', zIndex: 5 },
        { id: 'w3', zIndex: 2 },
      ]);
    });

    it('returns empty array if no windows provided', () => {
      expect(bringToFront([], 'w1')).toEqual([]);
    });

    it('returns unchanged list if window id not found', () => {
      const windows = [
        { id: 'w1', zIndex: 1 },
        { id: 'w2', zIndex: 5 },
      ];

      const result = bringToFront(windows, 'w3');
      expect(result).toEqual(windows);
    });

    it('handles negative z-indices gracefully, using base 0', () => {
      const windows = [
        { id: 'w1', zIndex: -5 },
        { id: 'w2', zIndex: -2 },
      ];

      const result = bringToFront(windows, 'w1');
      expect(result).toEqual([
        { id: 'w1', zIndex: 1 }, // max(0, -5, -2) + 1 = 1
        { id: 'w2', zIndex: -2 },
      ]);
    });
  });
});
