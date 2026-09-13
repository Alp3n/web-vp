/// <reference types="node" />
/**
 * Faza 1: renderuje wszystkie klatki z `assets/src` do atlasu PNG + JSON (Phaser „JSON Hash").
 *
 * - pakowanie półkowe (shelf/row), padding 1 px, szerokość = potęga 2, wysokość = potęga 2;
 * - walidacja palety: każdy kolor musi być z Endesga 32 (`assets/src/palette.ts`),
 *   jedyny wyjątek to czerń z alfą dla cienia — build pada z jasnym błędem, jeśli coś się wymknie;
 * - `pivot` w JSON = `anchor` sprite'a (Phaser: `setOrigin` / origin klatki).
 *
 * `buildAtlas()` jest eksportowane, żeby `scripts/preview-sprites.ts` i testy mogły go użyć
 * bez duplikowania logiki (`write: false` = dry-run, nic nie dotyka dysku).
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SPRITES } from '../assets/src/index.ts';
import { PALETTE_HEX } from '../assets/src/palette.ts';
import { frameNames, frameToRGBA, type SpriteDef } from '../assets/src/sprite.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'assets', 'src');
const BUILD_DIR = join(ROOT, 'assets', 'build');

export const ATLAS_PNG = 'atlas.png';
export const ATLAS_JSON = 'atlas.json';
export const PADDING = 1;
/** Kandydaci na szerokość atlasu (potęgi 2); wysokość dobierana jako potęga 2. */
const WIDTH_CANDIDATES = [512, 1024, 2048] as const;

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}

export interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: 'RGBA8888';
    size: { w: number; h: number };
    scale: string;
    padding: number;
  };
}

export interface BuildAtlasResult {
  json: AtlasJson;
  png: Buffer | null;
  width: number;
  height: number;
  frameCount: number;
  spriteCount: number;
  /** Zajętość powierzchni atlasu przez piksele klatek (bez paddingu), 0..1. */
  fill: number;
}

export interface BuildAtlasOptions {
  /** `false` = dry-run: liczy layout i JSON, nie zapisuje nic na dysk. Domyślnie `true`. */
  write?: boolean;
  /** Katalog wyjściowy. Domyślnie `assets/build`. */
  outDir?: string;
  /** `false` wycisza log. Domyślnie `true`. */
  log?: boolean;
}

interface Placement {
  name: string;
  def: SpriteDef;
  frameIndex: number;
  x: number;
  y: number;
}

const ALPHA_BLACK_RE = /^#000000[0-9a-f]{2}$/;

/** Twarda kontrola palety na wejściu do builda (PLAN.md §6: „Każdy sprite korzysta wyłącznie z niej"). */
export function validatePalette(sprites: Record<string, SpriteDef> = SPRITES): void {
  for (const [key, def] of Object.entries(sprites)) {
    for (const [char, hex] of Object.entries(def.palette)) {
      if (hex === null) continue;
      if (PALETTE_HEX.has(hex)) continue;
      if (ALPHA_BLACK_RE.test(hex)) continue;
      throw new Error(
        `build-atlas: sprite "${key}" używa koloru ${hex} (znak "${char}") spoza palety Endesga 32. ` +
          `Dozwolone: assets/src/palette.ts + czerń z alfą (#000000rr) dla cienia.`,
      );
    }
  }
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Pakowanie półkowe: klatki malejąco po wysokości, wiersze o wysokości najwyższej klatki. */
function pack(width: number, items: Array<{ name: string; def: SpriteDef; frameIndex: number }>): {
  placements: Placement[];
  height: number;
} | null {
  const sorted = [...items].sort((a, b) => b.def.height - a.def.height || a.name.localeCompare(b.name));
  const placements: Placement[] = [];
  let x = PADDING;
  let y = PADDING;
  let shelfH = 0;
  for (const item of sorted) {
    const w = item.def.width;
    const h = item.def.height;
    if (w + 2 * PADDING > width) return null;
    if (x + w + PADDING > width) {
      x = PADDING;
      y += shelfH + PADDING;
      shelfH = 0;
    }
    placements.push({ ...item, x, y });
    x += w + PADDING;
    shelfH = Math.max(shelfH, h);
  }
  return { placements, height: y + shelfH + PADDING };
}

export async function buildAtlas(options: BuildAtlasOptions = {}): Promise<BuildAtlasResult> {
  const write = options.write ?? true;
  const outDir = options.outDir ?? BUILD_DIR;
  const log = options.log ?? true;

  validatePalette();

  const items = Object.entries(SPRITES).flatMap(([key, def]) =>
    frameNames(key, def).map((name, frameIndex) => ({ name, def, frameIndex })),
  );
  if (items.length === 0) throw new Error('build-atlas: rejestr SPRITES jest pusty');

  let packed: { placements: Placement[]; height: number } | null = null;
  let width = 0;
  for (const candidate of WIDTH_CANDIDATES) {
    const result = pack(candidate, items);
    if (result && nextPow2(result.height) <= candidate) {
      packed = result;
      width = candidate;
      break;
    }
    if (result && packed === null) {
      packed = result;
      width = candidate;
    }
  }
  if (packed === null) throw new Error('build-atlas: nie udało się spakować klatek');
  const height = nextPow2(packed.height);

  const rgba = Buffer.alloc(width * height * 4);
  let usedPixels = 0;
  for (const p of packed.placements) {
    const src = frameToRGBA(p.def, p.frameIndex);
    usedPixels += p.def.width * p.def.height;
    for (let row = 0; row < p.def.height; row += 1) {
      const srcOffset = row * p.def.width * 4;
      const dstOffset = ((p.y + row) * width + p.x) * 4;
      rgba.set(src.subarray(srcOffset, srcOffset + p.def.width * 4), dstOffset);
    }
  }

  const frames: Record<string, AtlasFrame> = {};
  for (const p of [...packed.placements].sort((a, b) => a.name.localeCompare(b.name))) {
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.def.width, h: p.def.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.def.width, h: p.def.height },
      sourceSize: { w: p.def.width, h: p.def.height },
      pivot: { x: p.def.anchor.x, y: p.def.anchor.y },
    };
  }

  const json: AtlasJson = {
    frames,
    meta: {
      app: 'nightfall/build-atlas',
      version: '1.0',
      image: ATLAS_PNG,
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
      padding: PADDING,
    },
  };

  let png: Buffer | null = null;
  if (write) {
    png = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, ATLAS_PNG), png);
    await writeFile(join(outDir, ATLAS_JSON), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    await copyFile(join(SRC_DIR, 'icons', 'icon.svg'), join(outDir, 'icon.svg'));
  }

  const result: BuildAtlasResult = {
    json,
    png,
    width,
    height,
    frameCount: packed.placements.length,
    spriteCount: Object.keys(SPRITES).length,
    fill: usedPixels / (width * height),
  };

  if (log) {
    const kb = png ? (png.length / 1024).toFixed(1) : '—';
    console.log(
      `atlas: ${result.spriteCount} sprite'ów / ${result.frameCount} klatek -> ${width}×${height} ` +
        `(zajętość ${(result.fill * 100).toFixed(1)} %, PNG ${kb} kB)`,
    );
    if (write) console.log(`       assets/build/${ATLAS_PNG}, ${ATLAS_JSON}, icon.svg`);
  }
  return result;
}

const isMain = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  buildAtlas().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
