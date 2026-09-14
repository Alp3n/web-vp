/// <reference types="node" />
/**
 * Faza 2: drugi atlas — HUD. Źródła to ręcznie pisane SVG w `assets/src/hud/*.svg`
 * (PLAN.md §6: „SVG (HUD) … rasteryzować przez sharp w build-atlas do 2×, żeby były
 * ostre na retinie"). Wynik: `assets/build/hud.png` + `hud.json` w tym samym formacie
 * co atlas świata (Phaser „JSON Hash"), więc render ładuje go jednym `load.atlas`.
 *
 * Świat i HUD są w OSOBNYCH atlasach, bo mają inny pipeline (pixel art 1× vs wektor 2×)
 * i inne filtrowanie: atlas świata ładuje się z `pixelArt: true` i skaluje zoomem kamery,
 * HUD rysuje kamera bez zoomu i chce gładkich krawędzi.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HUD_SRC_DIR = join(ROOT, 'assets', 'src', 'hud');
const BUILD_DIR = join(ROOT, 'assets', 'build');

export const HUD_PNG = 'hud.png';
export const HUD_JSON = 'hud.json';
export const HUD_PADDING = 2;
/** Skala rasteryzacji: ikona 32 → 64 px, `btn_ring` 96 → 192 px (PLAN.md §6: „do 2×"). */
export const HUD_SCALE = 2;
/** Domyślne DPI, w jakim sharp rasteryzuje SVG — `HUD_SCALE ×` daje dokładnie 2×. */
const BASE_DPI = 72;
const WIDTH_CANDIDATES = [256, 512, 1024, 2048] as const;

/** Kontrakt nazw klatek HUD (docs/architecture.md, „Faza 2 — assets"). */
export const HUD_FRAMES = [
  'btn_ring',
  'icon_axe',
  'icon_build',
  'icon_cancel',
  'icon_generator',
  'icon_sawmill',
  'icon_tower',
  'icon_wall',
  'icon_wood',
  'radial_slot',
] as const;

export interface HudFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}

export interface HudJson {
  frames: Record<string, HudFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: 'RGBA8888';
    size: { w: number; h: number };
    /** `"2"` — klatki są w 2×, render skaluje je w dół o połowę. */
    scale: string;
    padding: number;
  };
}

export interface BuildHudResult {
  json: HudJson;
  png: Buffer | null;
  width: number;
  height: number;
  frameCount: number;
  fill: number;
}

export interface BuildHudOptions {
  /** `false` = dry-run (rasteryzuje i liczy layout, nie zapisuje). Domyślnie `true`. */
  write?: boolean;
  outDir?: string;
  log?: boolean;
}

interface Raster {
  name: string;
  w: number;
  h: number;
  data: Buffer;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Rasteryzuje jeden plik SVG do RGBA w skali `HUD_SCALE`. */
async function rasterize(name: string, svg: Buffer): Promise<Raster> {
  const image = sharp(svg, { density: BASE_DPI * HUD_SCALE });
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { name, w: info.width, h: info.height, data };
}

/** Pakowanie półkowe — te same reguły co w `build-atlas.ts`, tylko na buforach RGBA. */
function pack(width: number, items: Raster[]): { placed: Array<Raster & { x: number; y: number }>; height: number } | null {
  const sorted = [...items].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
  const placed: Array<Raster & { x: number; y: number }> = [];
  let x = HUD_PADDING;
  let y = HUD_PADDING;
  let shelfH = 0;
  for (const item of sorted) {
    if (item.w + 2 * HUD_PADDING > width) return null;
    if (x + item.w + HUD_PADDING > width) {
      x = HUD_PADDING;
      y += shelfH + HUD_PADDING;
      shelfH = 0;
    }
    placed.push({ ...item, x, y });
    x += item.w + HUD_PADDING;
    shelfH = Math.max(shelfH, item.h);
  }
  return { placed, height: y + shelfH + HUD_PADDING };
}

export async function buildHud(options: BuildHudOptions = {}): Promise<BuildHudResult> {
  const write = options.write ?? true;
  const outDir = options.outDir ?? BUILD_DIR;
  const log = options.log ?? true;

  const files = (await readdir(HUD_SRC_DIR)).filter((f) => f.endsWith('.svg')).sort();
  const names = files.map((f) => f.replace(/\.svg$/, ''));
  const missing = HUD_FRAMES.filter((n) => !names.includes(n));
  if (missing.length > 0) {
    throw new Error(`build-hud: brak źródeł SVG dla klatek: ${missing.join(', ')} (assets/src/hud/)`);
  }
  const extra = names.filter((n) => !(HUD_FRAMES as readonly string[]).includes(n));
  if (extra.length > 0) {
    throw new Error(`build-hud: SVG spoza kontraktu: ${extra.join(', ')} (dopisz je do HUD_FRAMES)`);
  }

  const rasters = await Promise.all(
    files.map(async (file) => rasterize(file.replace(/\.svg$/, ''), await readFile(join(HUD_SRC_DIR, file)))),
  );

  let packed: { placed: Array<Raster & { x: number; y: number }>; height: number } | null = null;
  let width = 0;
  for (const candidate of WIDTH_CANDIDATES) {
    const result = pack(candidate, rasters);
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
  if (packed === null) throw new Error('build-hud: nie udało się spakować klatek HUD');
  const height = nextPow2(packed.height);

  const rgba = Buffer.alloc(width * height * 4);
  let usedPixels = 0;
  for (const p of packed.placed) {
    usedPixels += p.w * p.h;
    for (let row = 0; row < p.h; row += 1) {
      const src = p.data.subarray(row * p.w * 4, (row + 1) * p.w * 4);
      rgba.set(src, ((p.y + row) * width + p.x) * 4);
    }
  }

  const frames: Record<string, HudFrame> = {};
  for (const p of [...packed.placed].sort((a, b) => a.name.localeCompare(b.name))) {
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.w, h: p.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
      sourceSize: { w: p.w, h: p.h },
      // HUD jest pozycjonowany od środka (ikona w przycisku, slot w menu radialnym)
      pivot: { x: 0.5, y: 0.5 },
    };
  }

  const json: HudJson = {
    frames,
    meta: {
      app: 'nightfall/build-hud',
      version: '1.0',
      image: HUD_PNG,
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: String(HUD_SCALE),
      padding: HUD_PADDING,
    },
  };

  let png: Buffer | null = null;
  if (write) {
    png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, HUD_PNG), png);
    await writeFile(join(outDir, HUD_JSON), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }

  const result: BuildHudResult = {
    json,
    png,
    width,
    height,
    frameCount: packed.placed.length,
    fill: usedPixels / (width * height),
  };

  if (log) {
    const kb = png ? (png.length / 1024).toFixed(1) : '—';
    console.log(
      `hud:   ${result.frameCount} ikon (SVG → ${HUD_SCALE}×) -> ${width}×${height} ` +
        `(zajętość ${(result.fill * 100).toFixed(1)} %, PNG ${kb} kB)`,
    );
    if (write) console.log(`       assets/build/${HUD_PNG}, ${HUD_JSON}`);
  }
  return result;
}

const isMain = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  buildHud().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
