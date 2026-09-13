/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { SPRITES, allFrameNames } from '../../assets/src/index.ts';
import { PALETTE_HEX } from '../../assets/src/palette.ts';

/**
 * Kontrakt nazw klatek z `docs/architecture.md` (sekcja „assets — pipeline").
 * Lista jawna: gdy kontrakt się zmieni, ten test ma paść.
 */
const REQUIRED_FRAMES = [
  'tile_grass0',
  'tile_grass1',
  'tile_grass2',
  'tile_dirt',
  'tile_water',
  'tree_full',
  'tree_chopped',
  'tree_stump',
  ...(['ne', 'se', 'sw', 'nw'] as const).flatMap((d) => [`worker_idle_${d}_0`, `worker_idle_${d}_1`]),
  ...(['ne', 'se', 'sw', 'nw'] as const).flatMap((d) => [0, 1, 2, 3].map((i) => `worker_walk_${d}_${i}`)),
  'shadow',
  'dot',
];

describe('rejestr SPRITES', () => {
  const names = allFrameNames();

  it('zawiera wszystkie nazwy klatek z kontraktu', () => {
    for (const name of REQUIRED_FRAMES) expect(names).toContain(name);
  });

  it('nie ma klatek spoza kontraktu ani duplikatów', () => {
    expect([...names].sort()).toEqual([...REQUIRED_FRAMES].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('kafle są diamentem 32×16 z kotwicą w środku', () => {
    for (const key of ['tile_grass0', 'tile_grass1', 'tile_grass2', 'tile_dirt', 'tile_water']) {
      const def = SPRITES[key]!;
      expect([key, def.width, def.height]).toEqual([key, 32, 16]);
      expect(def.anchor).toEqual({ x: 0.5, y: 0.5 });
      expect(def.frames).toHaveLength(1);
    }
  });

  it('drzewa i robotnik mają kotwicę u podstawy {0.5, 1}', () => {
    for (const key of Object.keys(SPRITES)) {
      if (!key.startsWith('tree_') && !key.startsWith('worker_')) continue;
      expect([key, SPRITES[key]!.anchor]).toEqual([key, { x: 0.5, y: 1 }]);
    }
  });

  it('robotnik: 16×24, idle 2 klatki, walk 4 klatki, 4 kierunki', () => {
    for (const d of ['ne', 'se', 'sw', 'nw']) {
      const idle = SPRITES[`worker_idle_${d}`]!;
      const walk = SPRITES[`worker_walk_${d}`]!;
      expect([d, idle.width, idle.height, idle.frames.length]).toEqual([d, 16, 24, 2]);
      expect([d, walk.width, walk.height, walk.frames.length]).toEqual([d, 16, 24, 4]);
    }
  });

  it('SW/NW to lustrzane odbicia SE/NE (PLAN §6: 4 kierunki + flip)', () => {
    for (const kind of ['idle', 'walk']) {
      for (const [src, dst] of [
        ['se', 'sw'],
        ['ne', 'nw'],
      ]) {
        const a = SPRITES[`worker_${kind}_${src}`]!;
        const b = SPRITES[`worker_${kind}_${dst}`]!;
        expect(b.frames.map((f) => f.map((r) => [...r].reverse().join('')))).toEqual(a.frames);
      }
    }
  });

  it('dół pnia drzewa leży w ostatnim rzędzie i jest wyśrodkowany na kotwicy', () => {
    for (const key of ['tree_full', 'tree_chopped', 'tree_stump']) {
      const def = SPRITES[key]!;
      const lastRow = def.frames[0]![def.height - 1]!;
      const xs = [...lastRow].flatMap((c, i) => (c === '.' ? [] : [i]));
      expect(xs.length).toBeGreaterThan(0);
      // środek ciężkości dolnego rzędu = kotwica (anchor.x * width), tolerancja 0.5 px
      const centre = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
      expect(Math.abs(centre - def.anchor.x * def.width)).toBeLessThanOrEqual(0.5);
    }
  });

  it('robotnik stoi stopami w ostatnim rzędzie', () => {
    for (const key of Object.keys(SPRITES)) {
      if (!key.startsWith('worker_')) continue;
      const def = SPRITES[key]!;
      for (const frame of def.frames) {
        expect([key, frame[def.height - 1]!.replace(/\./g, '')]).not.toEqual([key, '']);
      }
    }
  });

  it('każdy kolor pochodzi z palety (wyjątek: czerń z alfą w cieniu)', () => {
    for (const [key, def] of Object.entries(SPRITES)) {
      for (const hex of Object.values(def.palette)) {
        if (hex === null) continue;
        const ok = PALETTE_HEX.has(hex) || /^#000000[0-9a-f]{2}$/.test(hex);
        expect([key, hex, ok]).toEqual([key, hex, true]);
      }
    }
  });

  it('cień to elipsa 16×8 z alfą ~35 %', () => {
    const def = SPRITES['shadow']!;
    expect([def.width, def.height]).toEqual([16, 8]);
    expect(Object.values(def.palette)).toContain('#00000059');
  });

  it('dot to 1×1 biały piksel', () => {
    const def = SPRITES['dot']!;
    expect([def.width, def.height, def.frames[0]![0]!]).toEqual([1, 1, 'w']);
    expect(def.palette['w']).toBe('#ffffff');
  });
});
