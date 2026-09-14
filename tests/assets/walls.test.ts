/// <reference types="node" />
/**
 * Mur z auto-tilingiem: geometria, kotwica i — najważniejsze — CIĄGŁOŚĆ na styku kafli.
 *
 * Sąsiednie mury muszą się skleić w jedną ścianę: ani szczeliny (przezroczysty piksel
 * w środku ściany), ani ciemnej kreski konturu na granicy kafla. Test składa dwa sprite'y
 * dokładnie tak, jak zrobi to render (pivot z `ANCHOR_WALL`, kolejność malarska po `gx+gy`)
 * i sprawdza przekrój na wspólnej krawędzi.
 */
import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../assets/src/index.ts';
import { ANCHOR_WALL } from '../../assets/src/walls.ts';
import { PALETTE } from '../../assets/src/palette.ts';
import { pixelAt, type SpriteDef } from '../../assets/src/sprite.ts';

const TILE_W = 32;
const TILE_H = 16;
/** Połowa grubości segmentu w jednostkach kafla (== WALL_SEG_HALF w scripts/gen-grids.ts). */
const SEG_HALF = 3 / 16;
/** Wysokość segmentu nad ziemią (== WALL_SEG_H). */
const SEG_H = 14;

const gridToScreen = (gx: number, gy: number): { x: number; y: number } => ({
  x: ((gx - gy) * TILE_W) / 2,
  y: ((gx + gy) * TILE_H) / 2,
});

const wall = (mask: number): SpriteDef => SPRITES[`wall_${mask}`]!;

/** Lewy-górny róg sprite'a muru dla kafla (tx, ty) — dokładnie jak w renderze. */
function wallOrigin(tx: number, ty: number): { left: number; top: number } {
  const centre = gridToScreen(tx + 0.5, ty + 0.5);
  const def = wall(0);
  return {
    left: Math.round(centre.x - ANCHOR_WALL.x * def.width),
    top: Math.round(centre.y - ANCHOR_WALL.y * def.height),
  };
}

interface Placed {
  mask: number;
  tx: number;
  ty: number;
}

/** Składa mury na wspólnym płótnie w kolejności malarskiej (rosnące gx+gy). */
function compose(tiles: Placed[]): {
  colourAt: (x: number, y: number) => string | null;
  opaqueAt: (x: number, y: number) => boolean;
  pixels: Set<string>;
} {
  const canvas = new Map<string, string>();
  for (const t of [...tiles].sort((a, b) => a.tx + a.ty - (b.tx + b.ty))) {
    const def = wall(t.mask);
    const { left, top } = wallOrigin(t.tx, t.ty);
    for (let y = 0; y < def.height; y += 1) {
      for (let x = 0; x < def.width; x += 1) {
        const hex = pixelAt(def, 0, x, y);
        if (hex === null) continue;
        canvas.set(`${left + x},${top + y}`, hex);
      }
    }
  }
  return {
    colourAt: (x, y) => canvas.get(`${x},${y}`) ?? null,
    opaqueAt: (x, y) => canvas.has(`${x},${y}`),
    pixels: new Set(canvas.keys()),
  };
}

/**
 * Piksele wspólnego przekroju na krawędzi kafla (tam, gdzie mur przechodzi do sąsiada).
 * Przekrój to prostokąt: wzdłuż krawędzi szerokość segmentu, w pionie 0..SEG_H nad ziemią.
 *
 * Krawędź S (dolna-lewa, `fy = 1`): punkt (fx, 1, z) rzutuje się na
 *   cx = 16·fx,  cy = 8·fx + 8 − z   (układ kafla; sprite ma diament w dolnych 16 wierszach).
 * Krawędź E (dolna-prawa, `fx = 1`): cx = 32 − 16·fy, cy = 8 + 8·fy − z.
 */
function crossSection(tx: number, ty: number, edge: 's' | 'e'): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const def = wall(0);
  const { left, top } = wallOrigin(tx, ty);
  const BBOX_TOP = def.height - TILE_H; // 16 — ile wierszy sprite'a jest nad diamentem kafla
  for (let sy = 0; sy < def.height; sy += 1) {
    for (let sx = 0; sx < def.width; sx += 1) {
      const cx = sx + 0.5;
      const cy = sy + 0.5 - BBOX_TOP;
      const t = edge === 's' ? cx / 16 : (32 - cx) / 16; // pozycja wzdłuż krawędzi (fx albo fy)
      const z = 8 * t + 8 - cy;
      if (Math.abs(t - 0.5) >= SEG_HALF) continue;
      if (z < 0 || z > SEG_H) continue;
      out.push([left + sx, top + sy]);
    }
  }
  return out;
}

describe('mur — geometria i kotwica', () => {
  it('wall_0..wall_15 i wall_build to 32×32 z kotwicą w środku kafla', () => {
    for (const key of [...Array.from({ length: 16 }, (_, m) => `wall_${m}`), 'wall_build']) {
      const def = SPRITES[key]!;
      expect([key, def.width, def.height]).toEqual([key, 32, 32]);
      expect([key, def.anchor]).toEqual([key, { x: 0.5, y: 24 / 32 }]);
      expect([key, def.frames.length]).toEqual([key, 1]);
    }
  });

  it('maska steruje ramionami: każdy bit ma własny, wyłączny obszar sprite\'a', () => {
    // piksele leżące na ramieniu danego kierunku i NIGDZIE indziej (ramiona nachodzą na siebie
    // na ekranie, więc punkty kontrolne są wybrane z części widocznej tylko dla jednego bitu)
    const probe: Array<[number, string, number, number]> = [
      [1, 'N', 22, 6],
      [2, 'E', 25, 23],
      [4, 'S', 6, 23],
      [8, 'W', 9, 6],
    ];
    for (let mask = 0; mask < 16; mask += 1) {
      for (const [bit, label, x, y] of probe) {
        const opaque = pixelAt(wall(mask), 0, x, y) !== null;
        expect([mask, label, opaque]).toEqual([mask, label, (mask & bit) !== 0]);
      }
    }
  });

  it('każdy mur ma słupek: piksele nad środkiem kafla', () => {
    for (let mask = 0; mask < 16; mask += 1) {
      expect([mask, pixelAt(wall(mask), 0, 16, 24 - 12) !== null]).toEqual([mask, true]);
    }
  });

  it('wall_build jest drewniane i ma prześwity (rusztowanie, nie pełna bryła)', () => {
    const def = SPRITES['wall_build']!;
    const hexes = new Set(Object.values(def.palette).filter((h): h is string => h !== null));
    expect(hexes.has(PALETTE.leather) || hexes.has(PALETTE.brown)).toBe(true);
    expect(hexes.has(PALETTE.lightGrey)).toBe(false);
    // co najmniej kilka dziur w obrysie słupka: kolumna z przerwą w pionie
    let gaps = 0;
    for (let x = 0; x < def.width; x += 1) {
      const filled = [];
      for (let y = 0; y < def.height; y += 1) if (pixelAt(def, 0, x, y) !== null) filled.push(y);
      if (filled.length > 0 && filled[filled.length - 1]! - filled[0]! + 1 > filled.length) gaps += 1;
    }
    expect(gaps).toBeGreaterThan(3);
  });
});

describe('mur — ciągłość na styku kafli', () => {
  const pairs: Array<[string, Placed, Placed, 's' | 'e']> = [
    // N–S: kafel (0,0) ma sąsiada od S (bit 4), kafel (0,1) sąsiada od N (bit 1)
    ['N–S', { mask: 4, tx: 0, ty: 0 }, { mask: 1, tx: 0, ty: 1 }, 's'],
    // E–W: kafel (0,0) ma sąsiada od E (bit 2), kafel (1,0) sąsiada od W (bit 8)
    ['E–W', { mask: 2, tx: 0, ty: 0 }, { mask: 8, tx: 1, ty: 0 }, 'e'],
  ];

  for (const [label, near, far, edge] of pairs) {
    it(`${label}: przekrój na wspólnej krawędzi jest w całości zamalowany`, () => {
      const scene = compose([near, far]);
      const quad = crossSection(near.tx, near.ty, edge);
      expect(quad.length).toBeGreaterThan(30);
      for (const [x, y] of quad) {
        expect([label, x, y, scene.opaqueAt(x, y)]).toEqual([label, x, y, true]);
      }
    });

    it(`${label}: na styku nie ma ciemnej kreski konturu`, () => {
      const scene = compose([near, far]);
      // kontur (`navy`) wolno mieć tylko na sylwetce — piksel otoczony murem z każdej strony nie może być konturem
      for (const [x, y] of crossSection(near.tx, near.ty, edge)) {
        const inside =
          scene.opaqueAt(x - 1, y) && scene.opaqueAt(x + 1, y) && scene.opaqueAt(x, y - 1) && scene.opaqueAt(x, y + 1);
        if (!inside) continue;
        expect([label, x, y, scene.colourAt(x, y)]).not.toEqual([label, x, y, PALETTE.navy]);
      }
    });
  }

  it('prosty mur 3 kafle jest jedną spójną bryłą (4-spójność), w obu osiach', () => {
    const runs: Array<[string, Placed[]]> = [
      ['N–S', [
        { mask: 4, tx: 0, ty: 0 },
        { mask: 5, tx: 0, ty: 1 },
        { mask: 1, tx: 0, ty: 2 },
      ]],
      ['E–W', [
        { mask: 2, tx: 0, ty: 0 },
        { mask: 10, tx: 1, ty: 0 },
        { mask: 8, tx: 2, ty: 0 },
      ]],
    ];
    for (const [label, tiles] of runs) {
      const scene = compose(tiles);
      const all = scene.pixels;
      const start = all.values().next().value as string;
      const seen = new Set<string>([start]);
      const stack = [start];
      while (stack.length > 0) {
        const [sx, sy] = stack.pop()!.split(',').map(Number) as [number, number];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const key = `${sx + dx},${sy + dy}`;
          if (all.has(key) && !seen.has(key)) {
            seen.add(key);
            stack.push(key);
          }
        }
      }
      expect([label, seen.size]).toEqual([label, all.size]);
    }
  });

  it('kwadrat 5×5 murów nie ma dziur w pierścieniu (jedna spójna bryła)', () => {
    const ring = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      ring.add(`${i},0`);
      ring.add(`${i},4`);
      ring.add(`0,${i}`);
      ring.add(`4,${i}`);
    }
    const tiles: Placed[] = [...ring].map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      let mask = 0;
      if (ring.has(`${x},${y - 1}`)) mask |= 1;
      if (ring.has(`${x + 1},${y}`)) mask |= 2;
      if (ring.has(`${x},${y + 1}`)) mask |= 4;
      if (ring.has(`${x - 1},${y}`)) mask |= 8;
      return { mask, tx: x, ty: y };
    });
    const scene = compose(tiles);
    const all = scene.pixels;
    const start = all.values().next().value as string;
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length > 0) {
      const [sx, sy] = stack.pop()!.split(',').map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const key = `${sx + dx},${sy + dy}`;
        if (all.has(key) && !seen.has(key)) {
          seen.add(key);
          stack.push(key);
        }
      }
    }
    expect(seen.size).toBe(all.size);
  });
});
