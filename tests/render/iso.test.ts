import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W, TILE_H, TILE_W } from '../../src/sim';
import { depthFor, gridToScreen, mapBounds, screenToGrid } from '../../src/render/iso';

describe('gridToScreen', () => {
  it('zgadza się ze wzorem z kontraktu', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToScreen(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
    expect(gridToScreen(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
    expect(gridToScreen(1, 1)).toEqual({ x: 0, y: TILE_H });
  });

  it('sąsiedni kafel w +x jest przesunięty o (16, 8), w +y o (-16, 8)', () => {
    for (const [gx, gy] of [
      [0, 0],
      [3, 7],
      [63, 63],
      [12.5, 41.25],
    ] as const) {
      const base = gridToScreen(gx, gy);
      const east = gridToScreen(gx + 1, gy);
      const south = gridToScreen(gx, gy + 1);
      expect(east.x - base.x).toBe(16);
      expect(east.y - base.y).toBe(8);
      expect(south.x - base.x).toBe(-16);
      expect(south.y - base.y).toBe(8);
    }
  });

  it('środki sąsiadujących kafli są oddalone dokładnie o jeden krok siatki', () => {
    const a = gridToScreen(0.5, 0.5);
    const b = gridToScreen(1.5, 0.5);
    expect(b.x - a.x).toBe(TILE_W / 2);
    expect(b.y - a.y).toBe(TILE_H / 2);
  });
});

describe('screenToGrid', () => {
  it('jest odwrotnością gridToScreen (round-trip)', () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [32, 32],
      [63.5, 0.25],
      [-4, 17.75],
      [12.125, 48.875],
    ];
    for (const [gx, gy] of points) {
      const s = gridToScreen(gx, gy);
      const back = screenToGrid(s.x, s.y);
      expect(back.x).toBeCloseTo(gx, 10);
      expect(back.y).toBeCloseTo(gy, 10);
    }
  });

  it('round-trip działa też w drugą stronę (ekran -> siatka -> ekran)', () => {
    for (const [sx, sy] of [
      [0, 0],
      [16, 8],
      [-320, 144],
      [7.5, -3.25],
    ] as const) {
      const g = screenToGrid(sx, sy);
      const back = gridToScreen(g.x, g.y);
      expect(back.x).toBeCloseTo(sx, 10);
      expect(back.y).toBeCloseTo(sy, 10);
    }
  });

  it('kierunki ekranowe mapują się na przekątne siatki', () => {
    // W prawo na ekranie = NE w siatce (+x, -y); w dół = SE (+x, +y).
    const right = screenToGrid(1, 0);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeLessThan(0);
    const down = screenToGrid(0, 1);
    expect(down.x).toBeGreaterThan(0);
    expect(down.y).toBeGreaterThan(0);
  });
});

describe('depthFor', () => {
  it('równa się ekranowemu Y punktu', () => {
    expect(depthFor(3, 5)).toBe(gridToScreen(3, 5).y);
  });

  it('to, co bliżej dołu ekranu, ma większy depth', () => {
    expect(depthFor(5, 5)).toBeGreaterThan(depthFor(4, 5));
    expect(depthFor(5, 5)).toBeGreaterThan(depthFor(5, 4));
    // Kafel „przed" (na południe) jest rysowany po kaflu „za".
    expect(depthFor(2.5, 3.5)).toBeGreaterThan(depthFor(2.5, 2.5));
  });
});

describe('mapBounds', () => {
  it('obejmuje wszystkie rogi mapy', () => {
    const b = mapBounds(MAP_W, MAP_H);
    const corners = [
      gridToScreen(0, 0),
      gridToScreen(MAP_W, 0),
      gridToScreen(0, MAP_H),
      gridToScreen(MAP_W, MAP_H),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(b.x);
      expect(c.x).toBeLessThanOrEqual(b.x + b.width);
      expect(c.y).toBeGreaterThanOrEqual(b.y);
      expect(c.y).toBeLessThanOrEqual(b.y + b.height);
    }
  });

  it('skrajnie lewy kafel (0, MAP_H-1) ma ujemne x, a bounding box zaczyna się przed nim', () => {
    const b = mapBounds(MAP_W, MAP_H);
    const leftMost = gridToScreen(0.5, MAP_H - 0.5);
    expect(leftMost.x).toBeLessThan(0);
    expect(b.x).toBeLessThanOrEqual(leftMost.x - TILE_W / 2);
    expect(b.width).toBe((MAP_W + MAP_H) * (TILE_W / 2));
    expect(b.height).toBe((MAP_W + MAP_H) * (TILE_H / 2));
  });
});
