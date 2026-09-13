/// <reference types="node" />
/**
 * Generator siatek znaków dla sprite'ów, których kształt musi być matematycznie dokładny
 * (maska diamentu kafla, elipsa cienia, korona drzewa). Wynik to zwykłe literały
 * w `assets/src/tiles.ts` i `assets/src/nature.ts` — czytelne, wersjonowane i ręcznie edytowalne.
 *
 * Uruchamiaj świadomie: `npx tsx scripts/gen-grids.ts` (NADPISUJE oba pliki).
 * Ręczne poprawki pikseli rób w generatorze, nie w wygenerowanym pliku.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'assets', 'src');

const TILE_W = 32;
const TILE_H = 16;

/** Maska diamentu kafla — kontrakt docs/architecture.md: kafle stykają się przy offsecie (16, 8). */
function inTile(x: number, y: number): boolean {
  return Math.abs(x - 15.5) / 16 + Math.abs(y - 7.5) / 8 <= 1;
}

/** Mały deterministyczny RNG, żeby „organiczne" detale były powtarzalne. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type Detail = Record<string, string>;

function tileGrid(details: Detail): string[] {
  const rows: string[] = [];
  for (let y = 0; y < TILE_H; y += 1) {
    // skrajne piksele rzędu = obrys diamentu
    let first = -1;
    let last = -1;
    for (let x = 0; x < TILE_W; x += 1) {
      if (!inTile(x, y)) continue;
      if (first < 0) first = x;
      last = x;
    }
    let row = '';
    for (let x = 0; x < TILE_W; x += 1) {
      if (!inTile(x, y)) {
        row += '.';
        continue;
      }
      const override = details[`${x},${y}`];
      if (override !== undefined) {
        row += override;
        continue;
      }
      const onEdge = x === first || x === last;
      // światło od góry: górne krawędzie (NW/NE) rozjaśnione, dolne (SW/SE) przyciemnione — 1 px
      if (onEdge && y < TILE_H / 2) row += 'h';
      else if (onEdge) row += 'd';
      else row += 'b';
    }
    rows.push(row);
  }
  return rows;
}

/** Rozsypuje `count` pikseli `char` we wnętrzu kafla (bez krawędzi). */
function scatter(seed: number, count: number, char: string, taken: Detail, shape = [[0, 0]]): Detail {
  const rand = lcg(seed);
  const out: Detail = { ...taken };
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 4000) {
    guard += 1;
    const x = Math.floor(rand() * TILE_W);
    const y = Math.floor(rand() * TILE_H);
    const cells = shape.map(([dx, dy]) => [x + (dx as number), y + (dy as number)] as const);
    const ok = cells.every(
      ([cx, cy]) =>
        inTile(cx, cy) && inTile(cx, cy - 1) && inTile(cx, cy + 1) && out[`${cx},${cy}`] === undefined,
    );
    if (!ok) continue;
    for (const [cx, cy] of cells) out[`${cx},${cy}`] = char;
    placed += 1;
  }
  return out;
}

const TUFT = [
  [0, 0],
  [0, 1],
];

const tiles = {
  tile_grass0: tileGrid(scatter(7, 10, 'd', {})),
  tile_grass1: tileGrid(scatter(21, 5, 'd', scatter(13, 6, 't', {}, TUFT))),
  tile_grass2: tileGrid(scatter(41, 12, 'd', scatter(37, 3, 't', {}, TUFT))),
  tile_dirt: tileGrid(scatter(59, 7, 't', scatter(53, 12, 'd', {}))),
  // fale: ręcznie rozstawione, żeby czytały się jako poziome błyski, nie jako szum
  tile_water: tileGrid({
    '10,5': 't',
    '11,5': 't',
    '12,5': 't',
    '19,7': 't',
    '20,7': 't',
    '21,7': 't',
    '22,7': 't',
    '7,9': 't',
    '8,9': 't',
    '9,9': 't',
    '15,11': 't',
    '16,11': 't',
    '17,11': 't',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Drzewo 24×36. Pień zajmuje kolumny 10..13 → środek 12.0 = anchor.x * 24. ✔
// ─────────────────────────────────────────────────────────────────────────────
const TREE_W = 24;
const TREE_H = 36;

interface Blob {
  cx: number;
  cy: number;
  r: number;
}
const CROWN: Blob[] = [
  { cx: 12, cy: 14, r: 10.2 },
  { cx: 7.5, cy: 8.5, r: 6.2 },
  { cx: 16.5, cy: 9.5, r: 5.6 },
  { cx: 12, cy: 20, r: 7.8 },
];

function inCrown(x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  return CROWN.some((b) => (px - b.cx) ** 2 + (py - b.cy) ** 2 <= b.r * b.r);
}

/** Rzadsza korona dla `tree_chopped`: obrys zjedzony o 1 px + kilka stałych prześwitów. */
const CROWN_HOLES: Blob[] = [
  { cx: 15.5, cy: 10.5, r: 1.7 },
  { cx: 9, cy: 15, r: 1.6 },
  { cx: 16, cy: 19, r: 1.8 },
];

function inCrownSparse(x: number, y: number): boolean {
  if (!inCrown(x, y)) return false;
  // erozja obrysu o 1 px (korona rzadsza, mniejsza)
  if (!inCrown(x - 1, y) || !inCrown(x + 1, y) || !inCrown(x, y - 1) || !inCrown(x, y + 1)) return false;
  const px = x + 0.5;
  const py = y + 0.5;
  return !CROWN_HOLES.some((h) => (px - h.cx) ** 2 + (py - h.cy) ** 2 <= h.r * h.r);
}

function crownGrid(hit: (x: number, y: number) => boolean, trunkRows: string[], notch: boolean): string[] {
  // Światło pada od góry-lewej: jasny rąbek na łuku NW, ciemny na SE (PLAN.md §6).
  const lit = (x: number, y: number): number => x + 0.5 - 12 + (y + 0.5 - 14);
  const rimAt = (x: number, y: number): boolean =>
    hit(x, y) && (!hit(x - 1, y) || !hit(x + 1, y) || !hit(x, y - 1) || !hit(x, y + 1));
  const rows: string[] = [];
  for (let y = 0; y < TREE_H; y += 1) {
    let row = '';
    for (let x = 0; x < TREE_W; x += 1) {
      const trunkChar = trunkRows[y]?.[x] ?? '.';
      if (!hit(x, y)) {
        row += trunkChar;
        continue;
      }
      const d = lit(x, y);
      // Pełny ciemny kontur (1 px) oddziela koronę od trawy w tym samym odcieniu;
      // jasny rąbek leży tuż pod konturem od strony NW.
      const rim = rimAt(x, y);
      const innerRim = rimAt(x - 1, y) || rimAt(x + 1, y) || rimAt(x, y - 1) || rimAt(x, y + 1);
      if (rim) row += 'o';
      else if (innerRim && d < -1) row += 'c';
      else if (innerRim && d > 1) row += 'a';
      else if (d > 1 && (x * 5 + y * 3) % 11 === 0) row += 'a';
      else if (d < -1 && (x * 3 + y * 7) % 13 === 0) row += 'c';
      else row += 'b';
    }
    rows.push(row);
  }
  if (notch) {
    // nacięcie w pniu: klin wycięty od prawej, odsłonięte jasne drewno
    const cut: Array<[number, number, string]> = [
      [13, 29, 'w'],
      [12, 30, 'w'],
      [13, 30, '.'],
      [11, 31, 'w'],
      [12, 31, 'w'],
      [13, 31, '.'],
      [12, 32, 'w'],
      [13, 32, 'p'],
    ];
    for (const [x, y, ch] of cut) {
      const row = rows[y];
      if (row === undefined) continue;
      rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
    }
  }
  return rows;
}

function trunk(): string[] {
  const rows: string[] = new Array<string>(TREE_H).fill('.'.repeat(TREE_W));
  const put = (y: number, x: number, ch: string): void => {
    const row = rows[y];
    if (row === undefined) return;
    rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
  };
  for (let y = 21; y < TREE_H; y += 1) {
    put(y, 10, 'q'); // jasna lewa krawędź
    put(y, 11, 'p'); // baza
    put(y, 12, 'p');
    put(y, 13, 'o'); // cień po prawej
  }
  // korzenie: dwa ostatnie rzędy szersze (10..13 → 9..14, środek nadal 12.0)
  put(34, 9, 'p');
  put(34, 14, 'o');
  put(35, 9, 'q');
  put(35, 14, 'o');
  put(35, 10, 'p');
  put(35, 13, 'o');
  return rows;
}

const TRUNK = trunk();
const nature = {
  tree_full: crownGrid(inCrown, TRUNK, false),
  tree_chopped: crownGrid(inCrownSparse, TRUNK, true),
};

// ─────────────────────────────────────────────────────────────────────────────
// Cień: elipsa 16×8
// ─────────────────────────────────────────────────────────────────────────────
function shadowGrid(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    let row = '';
    for (let x = 0; x < 16; x += 1) {
      const dx = (x + 0.5 - 8) / 8;
      const dy = (y + 0.5 - 4) / 4;
      row += dx * dx + dy * dy <= 1 ? 's' : '.';
    }
    rows.push(row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────

const quote = (rows: string[]): string => rows.map((r) => `      '${r}',`).join('\n');

const tilesFile = `/**
 * WYGENEROWANE przez \`npx tsx scripts/gen-grids.ts\` — edytuj generator, nie ten plik.
 *
 * Kafle iso 32×16. Maska diamentu: \`|x-15.5|/16 + |y-7.5|/8 <= 1\` — sąsiednie kafle
 * przy offsecie (16, 8) stykają się bez dziur i bez nakładania (test: tests/assets/tiles.test.ts).
 * Podświetlenie górnej krawędzi (\`h\`) i przyciemnienie dolnej (\`d\`) dają głębię 2.5D (PLAN.md §6).
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_TILE, sprite, type SpriteDef } from './sprite.ts';

const GRASS = {
  b: PALETTE.midGreen,
  h: PALETTE.green,
  d: PALETTE.darkGreen,
  t: PALETTE.green,
};

const GRASS_DARK = {
  b: PALETTE.darkGreen,
  h: PALETTE.midGreen,
  d: PALETTE.darkTeal,
  t: PALETTE.midGreen,
};

const DIRT = {
  b: PALETTE.leather,
  h: PALETTE.skinShade,
  d: PALETTE.brown,
  t: PALETTE.tan,
};

const WATER = {
  b: PALETTE.darkBlue,
  h: PALETTE.blue,
  d: PALETTE.darkTeal,
  t: PALETTE.cyan,
};

export const tile_grass0: SpriteDef = sprite({
  name: 'tile_grass0',
  anchor: ANCHOR_TILE,
  palette: GRASS,
  frames: [
    [
${quote(tiles.tile_grass0)}
    ],
  ],
});

export const tile_grass1: SpriteDef = sprite({
  name: 'tile_grass1',
  anchor: ANCHOR_TILE,
  palette: GRASS,
  frames: [
    [
${quote(tiles.tile_grass1)}
    ],
  ],
});

export const tile_grass2: SpriteDef = sprite({
  name: 'tile_grass2',
  anchor: ANCHOR_TILE,
  palette: GRASS_DARK,
  frames: [
    [
${quote(tiles.tile_grass2)}
    ],
  ],
});

export const tile_dirt: SpriteDef = sprite({
  name: 'tile_dirt',
  anchor: ANCHOR_TILE,
  palette: DIRT,
  frames: [
    [
${quote(tiles.tile_dirt)}
    ],
  ],
});

export const tile_water: SpriteDef = sprite({
  name: 'tile_water',
  anchor: ANCHOR_TILE,
  palette: WATER,
  frames: [
    [
${quote(tiles.tile_water)}
    ],
  ],
});
`;

const natureFile = `/**
 * WYGENEROWANE przez \`npx tsx scripts/gen-grids.ts\` — edytuj generator, nie ten plik.
 *
 * Drzewo 24×36 (pień w kolumnach 10..13 → środek 12.0 = anchor.x × 24, dół pnia w ostatnim rzędzie),
 * pniak 8×8, cień 16×8, debugowa kropka 1×1.
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_FOOT, sprite, type SpriteDef } from './sprite.ts';

/** a = cień korony, b = liście, c = światło; p/q = pień, o = kontur i cień pnia, w = świeże drewno w nacięciu. */
const TREE = {
  a: PALETTE.darkTeal,
  b: PALETTE.darkGreen,
  c: PALETTE.midGreen,
  p: PALETTE.brown,
  q: PALETTE.leather,
  o: PALETTE.darkBrown,
  w: PALETTE.tan,
};

export const tree_full: SpriteDef = sprite({
  name: 'tree_full',
  anchor: ANCHOR_FOOT,
  palette: TREE,
  frames: [
    [
${quote(nature.tree_full)}
    ],
  ],
});

export const tree_chopped: SpriteDef = sprite({
  name: 'tree_chopped',
  anchor: ANCHOR_FOOT,
  palette: TREE,
  frames: [
    [
${quote(nature.tree_chopped)}
    ],
  ],
});

export const tree_stump: SpriteDef = sprite({
  name: 'tree_stump',
  anchor: ANCHOR_FOOT,
  palette: { w: PALETTE.tan, r: PALETTE.skinShade, q: PALETTE.leather, p: PALETTE.brown, o: PALETTE.darkBrown },
  frames: [
    [
      '..qqqq..',
      '.qwwwwq.',
      'qwwrrwwq',
      'qwrwwrwo',
      'qpppppoo',
      'qppppooo',
      '.ppoooo.',
      '..oooo..',
    ],
  ],
});

/**
 * Cień pod jednostkami: czerń z alfą ~35 % (\`#00000059\`) — jedyny dozwolony wyjątek
 * od palety Endesga 32, patrz \`assets/src/sprite.ts\` i \`docs/decisions.md\`.
 */
export const shadow: SpriteDef = sprite({
  name: 'shadow',
  anchor: { x: 0.5, y: 0.5 },
  palette: { s: '#00000059' },
  frames: [
    [
${quote(shadowGrid())}
    ],
  ],
});

/** 1×1 biały — debug, paski HUD, linie. */
export const dot: SpriteDef = sprite({
  name: 'dot',
  anchor: { x: 0.5, y: 0.5 },
  palette: { w: PALETTE.white },
  frames: [['w']],
});
`;

await writeFile(join(SRC_DIR, 'tiles.ts'), tilesFile, 'utf8');
await writeFile(join(SRC_DIR, 'nature.ts'), natureFile, 'utf8');
console.log('gen-grids: assets/src/tiles.ts, assets/src/nature.ts');
