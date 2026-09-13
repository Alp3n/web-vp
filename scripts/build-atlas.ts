/// <reference types="node" />
/**
 * Faza 0: minimalny build atlasu.
 * Tworzy `assets/build/` (publicDir Vite), pusty atlas w formacie Phaser "JSON Hash",
 * 1×1 przezroczysty PNG i kopiuje ikonę PWA.
 * Faza 1 rozbuduje skrypt o renderowanie sprite'ów z `assets/src`.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'assets', 'src');
const BUILD_DIR = join(ROOT, 'assets', 'build');

const ATLAS_PNG = 'atlas.png';
const ATLAS_JSON = 'atlas.json';
const PADDING = 1;

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  pivot?: { x: number; y: number };
}

async function main(): Promise<void> {
  await mkdir(BUILD_DIR, { recursive: true });

  // Faza 0: brak sprite'ów — pusty atlas 1×1 (przezroczysty).
  const frames: Record<string, AtlasFrame> = {};
  const width = 1;
  const height = 1;

  const png = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  await writeFile(join(BUILD_DIR, ATLAS_PNG), png);

  const atlas = {
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
  await writeFile(join(BUILD_DIR, ATLAS_JSON), `${JSON.stringify(atlas, null, 2)}\n`, 'utf8');

  await copyFile(join(SRC_DIR, 'icons', 'icon.svg'), join(BUILD_DIR, 'icon.svg'));

  const frameCount = Object.keys(frames).length;
  console.log(`atlas: ${frameCount} klatek -> assets/build/${ATLAS_PNG} (${width}×${height}), ${ATLAS_JSON}, icon.svg`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
