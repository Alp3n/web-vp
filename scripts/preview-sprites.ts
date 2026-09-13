/// <reference types="node" />
/**
 * Faza 0: minimalny podgląd sprite'ów.
 * Generuje `assets/build/preview.html`. Faza 1 wygeneruje siatkę ×4 z podpisami.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILD_DIR = join(ROOT, 'assets', 'build');
const ZOOM = 4;

async function main(): Promise<void> {
  await mkdir(BUILD_DIR, { recursive: true });

  const sprites: string[] = []; // Faza 1: nazwy klatek z assets/src
  const body =
    sprites.length === 0
      ? '<p class="empty">no sprites yet</p>'
      : sprites.map((name) => `<figure><img src="atlas.png" alt="${name}"><figcaption>${name}</figcaption></figure>`).join('\n');

  const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Nightfall — podgląd sprite'ów</title>
<style>
  body { margin: 0; padding: 24px; background: #0b0c14; color: #e6e8f0;
         font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  figure { margin: 0; text-align: center; }
  img { image-rendering: pixelated; transform: scale(${ZOOM}); transform-origin: top left; }
  figcaption { margin-top: 8px; color: #9aa0b4; font-family: ui-monospace, monospace; }
  .empty { color: #9aa0b4; }
</style>
</head>
<body>
<h1>Nightfall — podgląd sprite'ów (×${ZOOM})</h1>
<div class="grid">
${body}
</div>
</body>
</html>
`;

  await writeFile(join(BUILD_DIR, 'preview.html'), html, 'utf8');
  console.log(`preview: ${sprites.length} sprite'ów -> assets/build/preview.html`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
