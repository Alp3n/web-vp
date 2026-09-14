/// <reference types="node" />
/**
 * Faza 1: podgląd sprite'ów do obowiązkowej kontroli jakości (PLAN.md §6).
 *
 * Buduje atlas (przez `buildAtlas()` z `scripts/build-atlas.ts` — bez duplikowania logiki)
 * i generuje `assets/build/preview.html`:
 *  - pasek palety Endesga 32,
 *  - siatka WSZYSTKICH klatek ×4 z podpisem i rozmiarem, na szachownicy,
 *  - sekcja „składanie": kawałek mapy iso 4×4 z drzewami i robotnikiem, pozycjonowany
 *    dokładnie tak jak w grze (`gridToScreen` + `pivot` z atlasu) — do oceny styku kafli i kotwic.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAtlas, type AtlasFrame } from './build-atlas.ts';
import { PALETTE } from '../assets/src/palette.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILD_DIR = join(ROOT, 'assets', 'build');

const ZOOM = 4;
const TILE_W = 32;
const TILE_H = 16;

/** Kontrakt docs/architecture.md — ta sama projekcja co `src/render/iso.ts`. */
function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return { x: ((gx - gy) * TILE_W) / 2, y: ((gx + gy) * TILE_H) / 2 };
}

interface Ctx {
  frames: Record<string, AtlasFrame>;
  atlasW: number;
  atlasH: number;
}

function spriteStyle(ctx: Ctx, name: string, zoom: number): string {
  const f = ctx.frames[name];
  if (!f) throw new Error(`preview: brak klatki "${name}" w atlasie`);
  return [
    `width:${f.frame.w * zoom}px`,
    `height:${f.frame.h * zoom}px`,
    `background-position:${-f.frame.x * zoom}px ${-f.frame.y * zoom}px`,
    `background-size:${ctx.atlasW * zoom}px ${ctx.atlasH * zoom}px`,
  ].join(';');
}

function cell(ctx: Ctx, name: string): string {
  const f = ctx.frames[name]!;
  return `<figure class="cell">
  <div class="checker"><i class="spr" style="${spriteStyle(ctx, name, ZOOM)}"></i></div>
  <figcaption>${name}<br><small>${f.sourceSize.w}×${f.sourceSize.h} · pivot ${f.pivot.x},${f.pivot.y}</small></figcaption>
</figure>`;
}

/** Element w scenie: pozycja w kaflach + nazwa klatki; kotwica brana z atlasu. */
interface Placed {
  name: string;
  gx: number;
  gy: number;
}

function scene(ctx: Ctx, tiles: string[][], props: Placed[], zoom: number, originX: number, originY: number): string {
  const parts: string[] = [];
  const put = (name: string, gx: number, gy: number, depthBias: number): void => {
    const f = ctx.frames[name];
    if (!f) throw new Error(`preview: brak klatki "${name}"`);
    const s = gridToScreen(gx, gy);
    const left = (originX + s.x - f.pivot.x * f.frame.w) * zoom;
    const top = (originY + s.y - f.pivot.y * f.frame.h) * zoom;
    const depth = Math.round((gx + gy) * 100) + depthBias;
    parts.push(
      `<i class="spr abs" style="${spriteStyle(ctx, name, zoom)};left:${left}px;top:${top}px;z-index:${depth}"></i>`,
    );
  };
  tiles.forEach((row, gy) => row.forEach((name, gx) => put(name, gx, gy, -50)));
  for (const p of props) put(p.name, p.gx, p.gy, p.name === 'shadow' ? -1 : 0);
  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenka terenu wywyższonego — WZORZEC dla `src/render`.
//
// Kolejność malowania (docs/architecture.md): rosnące `gx + gy`, w rzędzie rosnące `gx`.
// Dla kafla: najpierw ściany klifu (sąsiad S / E niżej i nie jest rampą prowadzącą tutaj),
// potem wierzch przesunięty o `-elev * ELEV_PX`. Rampa zastępuje wierzch własnym sprite'em.
// ─────────────────────────────────────────────────────────────────────────────
const ELEV_PX = 10; // == ELEV_PX z src/sim/balance.ts i assets/src/terrain.ts

type UpDir = 'n' | 'e' | 's' | 'w';

interface Cell {
  tile: string;
  /** 0 = ziemia, 1 = płaskowyż. Kafel rampy ma poziom DOLNY. */
  elev: number;
  /** Kierunek „pod górę" w przestrzeni siatki; sąsiad w tę stronę jest o 1 wyżej. */
  ramp?: UpDir;
}

function terrainScene(ctx: Ctx, cells: Cell[][], props: Placed[], zoom: number, ox: number, oy: number): string {
  const parts: string[] = [];
  const h = cells.length;
  const w = cells[0]!.length;
  const at = (gx: number, gy: number): Cell =>
    gx < 0 || gy < 0 || gx >= w || gy >= h ? { tile: 'tile_grass0', elev: 0 } : cells[gy]![gx]!;

  const put = (name: string, gx: number, gy: number, dy: number, bias: number): void => {
    const f = ctx.frames[name];
    if (!f) throw new Error(`preview: brak klatki "${name}"`);
    const p = gridToScreen(gx, gy);
    const left = (ox + p.x - f.pivot.x * f.frame.w) * zoom;
    const top = (oy + p.y + dy - f.pivot.y * f.frame.h) * zoom;
    parts.push(
      `<i class="spr abs" style="${spriteStyle(ctx, name, zoom)};left:${left}px;top:${top}px;z-index:${Math.round((gx + gy) * 100) + bias}"></i>`,
    );
  };

  for (let sum = 0; sum <= w + h - 2; sum += 1) {
    for (let gx = 0; gx < w; gx += 1) {
      const gy = sum - gx;
      if (gy < 0 || gy >= h) continue;
      const c = at(gx, gy);
      if (c.ramp !== undefined) {
        put(`ramp_${c.ramp}`, gx, gy, -c.elev * ELEV_PX, -50);
        continue;
      }
      const south = at(gx, gy + 1);
      const east = at(gx + 1, gy);
      // rampa „prowadzi na ten kafel", gdy jej kierunek pod górę celuje w nas i różni się o 1 poziom
      const leadsHere = (n: Cell, dir: UpDir): boolean => n.ramp === dir && n.elev + 1 === c.elev;
      if (south.elev < c.elev && !leadsHere(south, 'n')) put('cliff_s', gx, gy, -(c.elev - 1) * ELEV_PX, -60);
      if (east.elev < c.elev && !leadsHere(east, 'w')) put('cliff_e', gx, gy, -(c.elev - 1) * ELEV_PX, -60);
      put(c.tile, gx, gy, -c.elev * ELEV_PX, -50);
    }
  }
  for (const p of props) {
    const dy = -at(p.gx, p.gy).elev * ELEV_PX;
    put(p.name, p.gx, p.gy, dy, p.name === 'shadow' ? -1 : 0);
  }
  return parts.join('\n');
}

/** Płaskowyż 3×3 (poziom 1) z 2-kaflową rampą `ramp_n` od strony S, głazami i drzewem. */
function plateauScene(): Cell[][] {
  const g = ['tile_grass0', 'tile_grass1', 'tile_grass2'];
  const cells: Cell[][] = Array.from({ length: 6 }, (_, gy) =>
    Array.from({ length: 6 }, (_, gx) => ({ tile: g[(gx * 2 + gy) % 3]!, elev: 0 })),
  );
  for (let gy = 1; gy <= 3; gy += 1) {
    for (let gx = 1; gx <= 3; gx += 1) {
      cells[gy]![gx] = { tile: g[(gx + gy) % 3]!, elev: 1 };
    }
  }
  // rampa 2-kaflowa pod płaskowyżem: kafle (1,4) i (2,4), pod górę na północ
  cells[4]![1] = { tile: 'tile_dirt', elev: 0, ramp: 'n' };
  cells[4]![2] = { tile: 'tile_dirt', elev: 0, ramp: 'n' };
  return cells;
}

const PLATEAU_PROPS: Placed[] = [
  { name: 'tree_full', gx: 2, gy: 1 },
  { name: 'rock_big', gx: 1, gy: 2 },
  { name: 'rock_small', gx: 3, gy: 1 },
  { name: 'rock_big', gx: 4, gy: 4 },
  { name: 'rock_small', gx: 0, gy: 3 },
  { name: 'shadow', gx: 2, gy: 3 },
  { name: 'worker_idle_se_0', gx: 2, gy: 3 },
  { name: 'tree_chopped', gx: 5, gy: 2 },
];

/** Cztery kierunki ramp obok siebie — każda wjeżdża na własny kafel płaskowyżu. */
function rampScene(up: UpDir): Cell[][] {
  const cells: Cell[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => ({ tile: 'tile_grass0', elev: 0 })),
  );
  const hi = { n: [1, 0], e: [2, 1], s: [1, 2], w: [0, 1] }[up]!;
  cells[hi[1]!]![hi[0]!] = { tile: 'tile_grass1', elev: 1 };
  cells[1]![1] = { tile: 'tile_dirt', elev: 0, ramp: up };
  return cells;
}

async function main(): Promise<void> {
  const atlas = await buildAtlas();
  const ctx: Ctx = { frames: atlas.json.frames, atlasW: atlas.width, atlasH: atlas.height };
  const names = Object.keys(ctx.frames).sort();

  const groups: Array<[string, (n: string) => boolean]> = [
    ['kafle', (n) => n.startsWith('tile_')],
    ['drzewa', (n) => n.startsWith('tree_')],
    ['robotnik — idle', (n) => n.startsWith('worker_idle_')],
    ['robotnik — walk', (n) => n.startsWith('worker_walk_')],
    ['klify i rampy', (n) => n.startsWith('cliff_') || n.startsWith('ramp_')],
    ['głazy', (n) => n.startsWith('rock_')],
    [
      'reszta',
      (n) =>
        !n.startsWith('tile_') &&
        !n.startsWith('tree_') &&
        !n.startsWith('worker_') &&
        !n.startsWith('cliff_') &&
        !n.startsWith('ramp_') &&
        !n.startsWith('rock_'),
    ],
  ];

  const sections = groups
    .map(([title, pred]) => {
      const list = names.filter(pred);
      if (list.length === 0) return '';
      return `<h2>${title} <small>(${list.length})</small></h2>\n<div class="grid">\n${list
        .map((n) => cell(ctx, n))
        .join('\n')}\n</div>`;
    })
    .join('\n');

  const g = ['tile_grass0', 'tile_grass1', 'tile_grass2'];
  const map: string[][] = [
    [g[0]!, g[1]!, g[2]!, 'tile_dirt'],
    [g[1]!, g[2]!, g[0]!, 'tile_dirt'],
    [g[2]!, g[0]!, g[1]!, 'tile_water'],
    ['tile_dirt', g[1]!, 'tile_water', 'tile_water'],
  ];
  const props: Placed[] = [
    { name: 'tree_full', gx: 1, gy: 0 },
    { name: 'tree_chopped', gx: 0, gy: 2 },
    { name: 'tree_stump', gx: 2, gy: 1 },
    { name: 'shadow', gx: 2, gy: 2 },
    { name: 'worker_walk_se_0', gx: 2, gy: 2 },
    { name: 'shadow', gx: 1, gy: 3 },
    { name: 'worker_idle_ne_0', gx: 1, gy: 3 },
  ];

  // Sam „dywan" kafli w powiększeniu — do wypatrywania szwów i dziur.
  const seamMap: string[][] = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => (x + y) % 2 === 0 ? g[0]! : g[1]!),
  );

  const plateau = plateauScene();

  const swatches = Object.entries(PALETTE)
    .map(([name, hex]) => `<i class="sw" style="background:${hex}" title="${name} ${hex}"></i>`)
    .join('');

  const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<link rel="icon" href="icon.svg">
<title>Nightfall — podgląd sprite'ów</title>
<style>
  :root { --bg:#0b0c14; --fg:#e6e8f0; --dim:#9aa0b4; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 24px 64px; background:var(--bg); color:var(--fg);
         font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:14px; margin:28px 0 10px; color:var(--dim); text-transform:uppercase; letter-spacing:.08em; }
  .meta { color:var(--dim); margin:0 0 12px; font-family:ui-monospace,monospace; }
  .palette { display:flex; flex-wrap:wrap; gap:2px; margin:0 0 8px; }
  .sw { width:22px; height:22px; display:block; border-radius:2px; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; }
  .cell { margin:0; text-align:center; }
  .checker { display:inline-flex; align-items:flex-end; justify-content:center; padding:6px;
             background-color:#1b1d2b;
             background-image:
               linear-gradient(45deg,#23263a 25%,transparent 25%,transparent 75%,#23263a 75%),
               linear-gradient(45deg,#23263a 25%,transparent 25%,transparent 75%,#23263a 75%);
             background-size:16px 16px; background-position:0 0,8px 8px;
             border:1px solid #2c3050; border-radius:4px; }
  figcaption { margin-top:6px; color:var(--dim); font-family:ui-monospace,monospace; font-size:11px; }
  .spr { display:block; background-image:url(atlas.png); background-repeat:no-repeat;
         image-rendering:pixelated; image-rendering:crisp-edges; }
  .abs { position:absolute; }
  .stage { position:relative; background:#05060c; border:1px solid #2c3050; border-radius:6px;
           margin:0 0 12px; overflow:hidden; }
</style>
</head>
<body>
<h1>Nightfall — podgląd sprite'ów (×${ZOOM})</h1>
<p class="meta">atlas ${atlas.width}×${atlas.height} · ${atlas.frameCount} klatek · ${atlas.spriteCount} sprite'ów · zajętość ${(atlas.fill * 100).toFixed(1)} %</p>
<div class="palette">${swatches}</div>

<h2>teren wywyższony — płaskowyż 3×3 + rampa 2-kaflowa (wzorzec dla src/render)</h2>
<p class="meta">ELEV_PX = ${ELEV_PX} · kolejność: rosnące gx+gy, w rzędzie rosnące gx · dla kafla: ściany, potem wierzch</p>
<div class="stage" style="width:800px;height:600px">
${terrainScene(ctx, plateau, PLATEAU_PROPS, 4, 104, 52)}
</div>
<div class="stage" style="width:1216px;height:900px">
${terrainScene(ctx, plateau, PLATEAU_PROPS, 6, 104, 52)}
</div>

<h2>rampy — cztery kierunki, każda wjeżdża na kafel wyżej (×4)</h2>
<div class="grid">
${(['n', 'e', 's', 'w'] as const)
  .map(
    (d) =>
      `<figure class="cell"><div class="stage" style="width:416px;height:272px">${terrainScene(ctx, rampScene(d), [], 4, 52, 20)}</div><figcaption>ramp_${d} — pod górę na ${d.toUpperCase()}</figcaption></figure>`,
  )
  .join('\n')}
</div>

${sections}

<h2>robotnik ×8 — klatki do oceny czytelności</h2>
<div class="grid">
${['worker_idle_se_0', 'worker_idle_se_1', 'worker_walk_se_0', 'worker_walk_se_1', 'worker_walk_se_2', 'worker_walk_se_3', 'worker_idle_ne_0', 'worker_walk_ne_0', 'worker_walk_ne_1', 'worker_idle_sw_0', 'worker_idle_nw_0']
  .map(
    (n) =>
      `<figure class="cell"><div class="checker"><i class="spr" style="${spriteStyle(ctx, n, 8)}"></i></div><figcaption>${n}</figcaption></figure>`,
  )
  .join('\n')}
</div>

<h2>drzewa ×8</h2>
<div class="grid">
${['tree_full', 'tree_chopped', 'tree_stump']
  .map(
    (n) =>
      `<figure class="cell"><div class="checker"><i class="spr" style="${spriteStyle(ctx, n, 8)}"></i></div><figcaption>${n}</figcaption></figure>`,
  )
  .join('\n')}
</div>

<h2>składanie — mapa iso 4×4 (gridToScreen, pivot z atlasu)</h2>
<div class="stage" style="width:640px;height:400px">
${scene(ctx, map, props, ZOOM, 80, 40)}
</div>

<h2>styk kafli — dywan 5×5 ×6 (szukamy dziur i nakładek)</h2>
<div class="stage" style="width:980px;height:500px">
${scene(ctx, seamMap, [], 6, 80, 10)}
</div>
</body>
</html>
`;

  await writeFile(join(BUILD_DIR, 'preview.html'), html, 'utf8');
  console.log(`preview: ${names.length} klatek -> assets/build/preview.html`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
