/// <reference types="node" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAtlas, PADDING, validatePalette } from '../../scripts/build-atlas.ts';
import { allFrameNames, SPRITES } from '../../assets/src/index.ts';
import { sprite } from '../../assets/src/sprite.ts';

const isPow2 = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

const tmpDirs: string[] = [];
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('buildAtlas() — dry run', () => {
  it('zwraca JSON ze wszystkimi klatkami i wymiarami będącymi potęgami 2', async () => {
    const result = await buildAtlas({ write: false, log: false });
    expect(result.png).toBeNull();
    expect(isPow2(result.width)).toBe(true);
    expect(isPow2(result.height)).toBe(true);
    expect(result.width).toBeGreaterThanOrEqual(512);
    expect(result.frameCount).toBe(allFrameNames().length);
    expect(Object.keys(result.json.frames).sort()).toEqual([...allFrameNames()].sort());
    expect(result.json.meta.size).toEqual({ w: result.width, h: result.height });
    expect(result.json.meta.format).toBe('RGBA8888');
    expect(result.json.meta.image).toBe('atlas.png');
  });

  it('każda klatka ma format Phaser JSON Hash: frame/rotated/trimmed/spriteSourceSize/sourceSize/pivot', async () => {
    const { json, width, height } = await buildAtlas({ write: false, log: false });
    for (const [name, f] of Object.entries(json.frames)) {
      expect([name, f.rotated, f.trimmed]).toEqual([name, false, false]);
      expect(f.sourceSize).toEqual({ w: f.frame.w, h: f.frame.h });
      expect(f.spriteSourceSize).toEqual({ x: 0, y: 0, w: f.frame.w, h: f.frame.h });
      expect(f.frame.x).toBeGreaterThanOrEqual(PADDING);
      expect(f.frame.y).toBeGreaterThanOrEqual(PADDING);
      expect(f.frame.x + f.frame.w).toBeLessThanOrEqual(width);
      expect(f.frame.y + f.frame.h).toBeLessThanOrEqual(height);
      expect(f.pivot.x).toBeGreaterThanOrEqual(0);
      expect(f.pivot.y).toBeLessThanOrEqual(1);
    }
  });

  it('pivot odpowiada kotwicy sprite\'a', async () => {
    const { json } = await buildAtlas({ write: false, log: false });
    expect(json.frames['tile_grass0']!.pivot).toEqual(SPRITES['tile_grass0']!.anchor);
    expect(json.frames['tree_full']!.pivot).toEqual(SPRITES['tree_full']!.anchor);
    expect(json.frames['worker_walk_se_2']!.pivot).toEqual(SPRITES['worker_walk_se']!.anchor);
  });

  it('klatki nie nachodzą na siebie (padding co najmniej 1 px)', async () => {
    const { json } = await buildAtlas({ write: false, log: false });
    const rects = Object.entries(json.frames).map(([name, f]) => ({ name, ...f.frame }));
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!;
        const b = rects[j]!;
        const gap =
          a.x + a.w + PADDING <= b.x ||
          b.x + b.w + PADDING <= a.x ||
          a.y + a.h + PADDING <= b.y ||
          b.y + b.h + PADDING <= a.y;
        expect([a.name, b.name, gap]).toEqual([a.name, b.name, true]);
      }
    }
  });
});

describe('buildAtlas() — zapis', () => {
  it('zapisuje atlas.png, atlas.json i icon.svg do wskazanego katalogu', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nightfall-atlas-'));
    tmpDirs.push(dir);
    const result = await buildAtlas({ write: true, outDir: dir, log: false });

    expect(result.png).not.toBeNull();
    // sygnatura PNG
    expect([...result.png!.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const onDisk = await readFile(join(dir, 'atlas.png'));
    expect(onDisk.equals(result.png!)).toBe(true);

    const parsed: unknown = JSON.parse(await readFile(join(dir, 'atlas.json'), 'utf8'));
    expect(parsed).toEqual(result.json);

    const icon = await readFile(join(dir, 'icon.svg'), 'utf8');
    expect(icon).toContain('<svg');
  });
});

describe('validatePalette()', () => {
  it('przepuszcza rejestr gry', () => {
    expect(() => validatePalette()).not.toThrow();
  });

  it('pada z jasnym błędem, gdy sprite użyje koloru spoza palety', () => {
    // sprite() waliduje przy tworzeniu, więc obchodzimy je i podmieniamy paletę „ręcznie"
    const rogue = sprite({ name: 'rogue', palette: { a: '#ffffff' }, frames: [['a']] });
    const tampered = { ...rogue, palette: { ...rogue.palette, a: '#010203' } };
    expect(() => validatePalette({ rogue: tampered })).toThrowError(
      /sprite "rogue" używa koloru #010203 \(znak "a"\) spoza palety Endesga 32/,
    );
  });
});
