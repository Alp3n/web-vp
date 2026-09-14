/// <reference types="node" />
/**
 * Drugi atlas: HUD (SVG → PNG 2×). Sprawdzamy kontrakt nazw, rozmiary po rasteryzacji,
 * format JSON (ten sam co atlas świata) i to, że ikony trzymają się palety Endesga 32.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildHud, HUD_FRAMES, HUD_PADDING, HUD_SCALE } from '../../scripts/build-hud.ts';
import { PALETTE, PALETTE_HEX } from '../../assets/src/palette.ts';

const HUD_SRC = fileURLToPath(new URL('../../assets/src/hud', import.meta.url));
const isPow2 = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

/** Rozmiary źródłowych viewBoxów (px przed skalowaniem 2×). */
const SOURCE_SIZE: Record<string, number> = {
  btn_ring: 96,
  radial_slot: 64,
};
const ICON_SIZE = 32;

describe('atlas HUD', () => {
  it('ma dokładnie klatki z kontraktu i rozmiary 2× źródła', async () => {
    const { json, width, height } = await buildHud({ write: false, log: false });
    expect(Object.keys(json.frames).sort()).toEqual([...HUD_FRAMES].sort());
    expect(isPow2(width) && isPow2(height)).toBe(true);
    for (const name of HUD_FRAMES) {
      const f = json.frames[name]!;
      const src = SOURCE_SIZE[name] ?? ICON_SIZE;
      expect([name, f.frame.w, f.frame.h]).toEqual([name, src * HUD_SCALE, src * HUD_SCALE]);
      expect([name, f.pivot]).toEqual([name, { x: 0.5, y: 0.5 }]);
      expect([name, f.rotated, f.trimmed]).toEqual([name, false, false]);
      expect([name, f.sourceSize]).toEqual([name, { w: f.frame.w, h: f.frame.h }]);
    }
    expect(json.meta.format).toBe('RGBA8888');
    expect(json.meta.image).toBe('hud.png');
    expect(json.meta.scale).toBe(String(HUD_SCALE));
    expect(json.meta.size).toEqual({ w: width, h: height });
  });

  it('klatki nie nachodzą na siebie i mieszczą się w teksturze', async () => {
    const { json, width, height } = await buildHud({ write: false, log: false });
    const rects = Object.values(json.frames).map((f) => f.frame);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(HUD_PADDING);
      expect(r.y).toBeGreaterThanOrEqual(HUD_PADDING);
      expect(r.x + r.w).toBeLessThanOrEqual(width);
      expect(r.y + r.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect([i, j, overlap]).toEqual([i, j, false]);
      }
    }
  });

  it('każda klatka HUD ma źródło SVG i żadnego SVG nie ma w nadmiarze', async () => {
    const files = (await readdir(HUD_SRC)).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, ''));
    expect(files.sort()).toEqual([...HUD_FRAMES].sort());
  });

  it('ikony używają wyłącznie kolorów z palety (cream + czarny kontur)', async () => {
    for (const name of HUD_FRAMES) {
      const svg = await readFile(join(HUD_SRC, `${name}.svg`), 'utf8');
      const colours = [...svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());
      expect([name, colours.length > 0]).toEqual([name, true]);
      for (const hex of colours) {
        expect([name, hex, PALETTE_HEX.has(hex)]).toEqual([name, hex, true]);
      }
      if (name.startsWith('icon_')) {
        expect([name, colours.includes(PALETTE.cream)]).toEqual([name, true]);
        expect([name, colours.includes(PALETTE.black)]).toEqual([name, true]);
      }
    }
  });

  it('przyciski są półprzezroczyste, ikony pełne', async () => {
    const ring = await readFile(join(HUD_SRC, 'btn_ring.svg'), 'utf8');
    const slot = await readFile(join(HUD_SRC, 'radial_slot.svg'), 'utf8');
    expect(ring).toContain('fill-opacity="0.35"');
    expect(slot).toContain('fill-opacity="0.5"');
    for (const name of HUD_FRAMES.filter((n) => n.startsWith('icon_'))) {
      const svg = await readFile(join(HUD_SRC, `${name}.svg`), 'utf8');
      expect([name, svg.includes('fill-opacity')]).toEqual([name, false]);
    }
  });
});
