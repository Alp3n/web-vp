/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../assets/src/index.ts';
import { pixelAt, type SpriteDef } from '../../assets/src/sprite.ts';

const TILE_KEYS = ['tile_grass0', 'tile_grass1', 'tile_grass2', 'tile_dirt', 'tile_water'];
const TILE_W = 32;
const TILE_H = 16;

/** Kontraktowa maska diamentu (docs/architecture.md + PLAN §6). */
function inDiamond(x: number, y: number): boolean {
  return Math.abs(x - 15.5) / 16 + Math.abs(y - 7.5) / 8 <= 1;
}

function maskOf(def: SpriteDef): boolean[][] {
  return Array.from({ length: def.height }, (_, y) =>
    Array.from({ length: def.width }, (_, x) => pixelAt(def, 0, x, y) !== null),
  );
}

describe('kafle iso', () => {
  it('wszystkie kafle mają identyczną, kontraktową maskę diamentu', () => {
    for (const key of TILE_KEYS) {
      const mask = maskOf(SPRITES[key]!);
      for (let y = 0; y < TILE_H; y += 1) {
        for (let x = 0; x < TILE_W; x += 1) {
          expect([key, x, y, mask[y]![x]!]).toEqual([key, x, y, inDiamond(x, y)]);
        }
      }
    }
  });

  it('maska ma 256 px = pole podstawowe siatki iso (32·16/2)', () => {
    const mask = maskOf(SPRITES['tile_grass0']!);
    const count = mask.flat().filter(Boolean).length;
    expect(count).toBe((TILE_W * TILE_H) / 2);
  });

  /**
   * Najważniejszy test pipeline'u: kafle ułożone w siatkę iso (offsety (16, 8) i (-16, 8))
   * muszą pokryć płaszczyznę bez dziur i bez nakładania.
   */
  it('sąsiednie kafle stykają się bez dziur i bez nakładania', () => {
    const mask = maskOf(SPRITES['tile_grass0']!);
    const N = 9;
    const OX = (N + 1) * (TILE_W / 2);
    const OY = TILE_H;
    const W = 2 * N * TILE_W;
    const H = 2 * N * TILE_H;
    const cover = new Int32Array(W * H);

    for (let gx = 0; gx < N; gx += 1) {
      for (let gy = 0; gy < N; gy += 1) {
        // gridToScreen + kotwica {0.5, 0.5} → lewy górny róg kafla
        const left = OX + ((gx - gy) * TILE_W) / 2 - TILE_W / 2;
        const top = OY + ((gx + gy) * TILE_H) / 2 - TILE_H / 2;
        for (let y = 0; y < TILE_H; y += 1) {
          for (let x = 0; x < TILE_W; x += 1) {
            if (!mask[y]![x]!) continue;
            const px = left + x;
            const py = top + y;
            expect(px >= 0 && px < W && py >= 0 && py < H).toBe(true);
            cover[py * W + px]! += 1;
          }
        }
      }
    }

    // 1. nigdzie nie ma nakładania
    let maxCover = 0;
    for (const c of cover) if (c > maxCover) maxCover = c;
    expect(maxCover).toBe(1);

    // 2. wnętrze (kafel 4,4 z wszystkimi sąsiadami) jest pokryte w 100 %
    const cl = OX + ((4 - 4) * TILE_W) / 2 - TILE_W / 2;
    const ct = OY + ((4 + 4) * TILE_H) / 2 - TILE_H / 2;
    const holes: string[] = [];
    for (let y = ct; y < ct + TILE_H; y += 1) {
      for (let x = cl; x < cl + TILE_W; x += 1) {
        if (cover[y * W + x] !== 1) holes.push(`${x},${y}=${cover[y * W + x]}`);
      }
    }
    expect(holes).toEqual([]);

    // 3. szerszy prostokąt w środku dywanu też bez dziur
    for (let y = ct - TILE_H; y < ct + 2 * TILE_H; y += 1) {
      for (let x = cl - TILE_W; x < cl + 2 * TILE_W; x += 1) {
        expect([x, y, cover[y * W + x]]).toEqual([x, y, 1]);
      }
    }
  });

  it('górna krawędź jest rozjaśniona, dolna przyciemniona (głębia 2.5D)', () => {
    for (const key of ['tile_grass0', 'tile_dirt', 'tile_water']) {
      const def = SPRITES[key]!;
      const topEdge = pixelAt(def, 0, 15, 0);
      const bottomEdge = pixelAt(def, 0, 15, 15);
      expect([key, topEdge, bottomEdge]).not.toEqual([key, null, null]);
      expect(topEdge).not.toBe(bottomEdge);
      const lum = (hex: string): number =>
        Number.parseInt(hex.slice(1, 3), 16) * 0.3 +
        Number.parseInt(hex.slice(3, 5), 16) * 0.59 +
        Number.parseInt(hex.slice(5, 7), 16) * 0.11;
      expect([key, lum(topEdge!) > lum(bottomEdge!)]).toEqual([key, true]);
    }
  });

  it('warianty trawy różnią się detalem, nie kształtem', () => {
    const [a, b, c] = ['tile_grass0', 'tile_grass1', 'tile_grass2'].map((k) => SPRITES[k]!.frames[0]!);
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });
});
