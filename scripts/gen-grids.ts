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

/** Trzy siatki trawy. Warianty „hi" (poziom 1) to TE SAME siatki, tylko jaśniejsza paleta. */
const GRASS_GRIDS = [
  tileGrid(scatter(7, 10, 'd', {})),
  tileGrid(scatter(21, 5, 'd', scatter(13, 6, 't', {}, TUFT))),
  tileGrid(scatter(41, 12, 'd', scatter(37, 3, 't', {}, TUFT))),
];

const tiles = {
  tile_grass0: GRASS_GRIDS[0]!,
  tile_grass1: GRASS_GRIDS[1]!,
  tile_grass2: GRASS_GRIDS[2]!,
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

// ─────────────────────────────────────────────────────────────────────────────
// Wywyższenia: klify `cliff_s`/`cliff_e`, rampy `ramp_{n|e|s|w}` (+ warianty
// `_inner` bez ścianki bocznej) — kontrakt docs/architecture.md „Wywyższenia".
//
// Układ kafla (te same współrzędne, co maska diamentu 32×16):
//   T = (16,0) górny narożnik, R = (32,8) prawy, B = (16,16) dolny, L = (0,8) lewy.
//   Krawędź N (sąsiad gy-1) = T→R (górna-prawa),  E (gx+1) = R→B (dolna-prawa),
//            S (gy+1)       = B→L (dolna-lewa),   W (gx-1) = L→T (górna-lewa).
//   Parametry powierzchni: fx rośnie wzdłuż T→R (czyli +gx), fy wzdłuż T→L (+gy);
//   ekran:  sx = 16 + 16·fx − 16·fy,  sy = 8·fx + 8·fy − ELEV_PX·h(fx,fy).
//
// Kamera patrzy z góry-lewej (od −gx,−gy), więc widoczne są wyłącznie ściany
// S i E; ściany N/W zasłania sam blok. Światło pada z góry-lewej ⇒ ściana S
// (normalna w stronę +gy, ekranowo dół-lewo) jest JAŚNIEJSZA, ściana E
// (normalna +gx, ekranowo dół-prawo) o jeden odcień CIEMNIEJSZA.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wysokość klifu w pikselach 1×. MUSI być równa `ELEV_PX` z `src/sim/balance.ts`
 * — `assets/src`/`scripts` nie importują z `src/`, więc to świadoma duplikacja.
 */
const ELEV_PX = 10;

/** h(fx,fy) = a + b·fx + c·fy — ułamek wysokości powierzchni kafla (0 = ziemia, 1 = poziom wyżej). */
interface Slope {
  a: number;
  b: number;
  c: number;
}

/** Kafel płaski na górnym poziomie: h ≡ 1 (używane do ścian klifu). */
const FLAT: Slope = { a: 1, b: 0, c: 0 };

/** Rampy: podniesiona jest krawędź „pod górę", przeciwna leży na ziemi. */
const RAMP_SLOPE = {
  n: { a: 1, b: 0, c: -1 }, // h = 1 − fy  → podniesione T i R (krawędź N)
  e: { a: 0, b: 1, c: 0 }, //  h = fx      → podniesione R i B (krawędź E)
  s: { a: 0, b: 0, c: 1 }, //  h = fy      → podniesione B i L (krawędź S)
  w: { a: 1, b: -1, c: 0 }, // h = 1 − fx  → podniesione L i T (krawędź W)
} as const satisfies Record<string, Slope>;

type UpDir = keyof typeof RAMP_SLOPE;

/** Bok, na którym rampa ma widoczną ściankę (jedyny bok zwrócony do kamery i nierówny z ziemią). */
const RAMP_WALL_SIDE: Record<UpDir, 's' | 'e'> = { n: 'e', e: 's', s: 'e', w: 's' };

const hAt = (s: Slope, fx: number, fy: number): number => s.a + s.b * fx + s.c * fy;

/**
 * Odwrotność rzutu wierzchu: piksel (cx,cy) w układzie kafla → (fx,fy) albo `null` poza kaflem.
 * Odwzorowanie jest afiniczne i odwracalne, więc każdy piksel wierzchu ma dokładnie jedno (fx,fy)
 * — stąd brak dziur i brak podwójnego malowania.
 */
function topUV(s: Slope, cx: number, cy: number): { fx: number; fy: number } | null {
  const p = 8 - ELEV_PX * s.b;
  const q = 8 - ELEV_PX * s.c;
  const det = 16 * (p + q);
  const u = cx - 16;
  const v = cy + ELEV_PX * s.a;
  const fx = (q * u + 16 * v) / det;
  const fy = (-p * u + 16 * v) / det;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return { fx, fy };
}

/** Trafienie w ściankę: `d` = głębokość pod krawędzią wierzchu, `max` = wysokość ścianki, `t` = pozycja wzdłuż niej. */
interface WallHit {
  d: number;
  max: number;
  t: number;
}

/** Ściana S: pod krawędzią B→L (dolna-lewa), czyli fy = 1. */
function wallS(s: Slope, cx: number, cy: number): WallHit | null {
  const fx = cx / 16;
  if (fx <= 0 || fx >= 1) return null;
  const max = ELEV_PX * hAt(s, fx, 1);
  if (max <= 0) return null;
  const d = cy - (8 * fx + 8 - max);
  return d > 0 && d <= max ? { d, max, t: fx } : null;
}

/** Ściana E: pod krawędzią R→B (dolna-prawa), czyli fx = 1. */
function wallE(s: Slope, cx: number, cy: number): WallHit | null {
  const fy = (32 - cx) / 16;
  if (fy <= 0 || fy >= 1) return null;
  const max = ELEV_PX * hAt(s, 1, fy);
  if (max <= 0) return null;
  const d = cy - (8 + 8 * fy - max);
  return d > 0 && d <= max ? { d, max, t: 1 - fy } : null;
}

/** Kamienne warstwy od góry ściany w dół: rąbek, jasna ława, baza, ciemniejszy spód, kontur. */
const CLIFF_STRATA = ['g', 'l', 'b', 'b', 'd', 'b', 'b', 'd', 'd', 'o'];

/** `fringe` = znak pierwszego rzędu tuż pod wierzchem (trawa dla klifu, ubita ziemia dla rampy). */
function rockChar(hit: WallHit, fringe: string): string {
  if (hit.d > hit.max - 1) return 'o'; // 1-px ciemny kontur wzdłuż dolnej krawędzi ściany
  const r = Math.min(Math.floor(hit.d), ELEV_PX - 1);
  if (r === 0) return fringe;
  const base = CLIFF_STRATA[r]!;
  const n = (Math.floor(hit.t * 16) * 7 + r * 13) % 11;
  if (base === 'b' && n === 0) return 'd';
  if (base === 'b' && n === 5) return 'l';
  if (base === 'd' && n === 3) return 'b';
  return base;
}

/**
 * Klif 16×(8+ELEV_PX). Sprite leży WEWNĄTRZ nieprzesuniętego diamentu kafla:
 * od krawędzi wierzchu podniesionego o ELEV_PX w dół do krawędzi na poziomie gruntu
 * (docs/architecture.md: „Ściany leżą wewnątrz nieprzesuniętego diamentu kafla").
 * Lewy-górny róg sprite'a w układzie kafla: S → (0, 8−ELEV_PX), E → (16, 8−ELEV_PX).
 */
function cliffGrid(side: 's' | 'e'): string[] {
  const ox = side === 's' ? 0 : 16;
  const oy = 8 - ELEV_PX;
  const rows: string[] = [];
  for (let sy = 0; sy < 8 + ELEV_PX; sy += 1) {
    let row = '';
    for (let sx = 0; sx < 16; sx += 1) {
      const cx = ox + sx + 0.5;
      const cy = oy + sy + 0.5;
      const hit = side === 's' ? wallS(FLAT, cx, cy) : wallE(FLAT, cx, cy);
      row += hit === null ? '.' : rockChar(hit, 'g');
    }
    rows.push(row);
  }
  return rows;
}

// ─── Rąbek górnej krawędzi płaskowyżu (`ledge_n`, `ledge_w`) ──────────────────
// Ściany N i W są niewidoczne (zasłania je sam blok), więc od strony górnej-ekranowej
// wierzch płaskowyżu zlewał się z gruntem za nim — gracz nie widział, gdzie kończy się
// poziom 1. Rąbek to 1-px świetlna sylwetka na samej krawędzi diamentu + cień pod nią.

/** Ile rzędów cienia pod świetlnym rąbkiem. */
const LEDGE_SHADE = 2;
/** Sprite rąbka: górna połowa kafla (8 rzędów) + zapas na cień. */
const LEDGE_H = 8 + LEDGE_SHADE;

/**
 * Rząd, w którym krawędź diamentu przechodzi przez kolumnę `tx`.
 * Krawędź iso ma 2 px na rząd, więc `ledge_n` (T→R) zajmuje x ∈ {15+2r, 16+2r},
 * a `ledge_w` (L→T) x ∈ {15−2r, 16−2r}.
 */
function ledgeEdgeRow(side: 'n' | 'w', tx: number): number {
  return side === 'n' ? Math.floor((tx - 15) / 2) : Math.floor((16 - tx) / 2);
}

/**
 * Rąbek 16×(8+LEDGE_SHADE) malowany PO wierzchu kafla, w jego górnej połowie:
 * `h` = 1 px światła na sylwetce, `s` = cień tuż pod nim. Lewy-górny róg sprite'a
 * w układzie kafla: N → (16, 0), W → (0, 0).
 */
function ledgeGrid(side: 'n' | 'w'): string[] {
  const ox = side === 'n' ? 16 : 0;
  const rows: string[] = [];
  for (let sy = 0; sy < LEDGE_H; sy += 1) {
    let row = '';
    for (let sx = 0; sx < 16; sx += 1) {
      const tx = ox + sx;
      const d = sy - ledgeEdgeRow(side, tx);
      if (d < 0 || d > LEDGE_SHADE || !inTile(tx, sy)) row += '.';
      else row += d === 0 ? 'h' : 's';
    }
    rows.push(row);
  }
  // cień przy prawym/lewym narożniku wychodzi poza diament, więc ostatnie rzędy bywają puste
  while (rows.length > 0 && !rows[rows.length - 1]!.includes('h') && !rows[rows.length - 1]!.includes('s')) {
    rows.pop();
  }
  return rows;
}

/** Wierzch rampy: ubita droga z 1-px podstopnicami co 1/5 wysokości i rozsypanym żwirem. */
function roadChar(s: Slope, fx: number, fy: number, cx: number, cy: number): string {
  // Bez rąbka na bokach: rampa jest 2-kaflowa, więc ciemna krawędź dzieliłaby ją na pół.
  // 3 pasma wysokości -> 2 stopnie: ciemna podstopnica + rozświetlony nos nad nią.
  // To jedyny czytelny sygnał „to jest podjazd" — sama pochyłość jest w iso prawie niewidoczna.
  const band = (uv: { fx: number; fy: number } | null): number | null =>
    uv === null ? null : Math.min(2, Math.floor(hAt(s, uv.fx, uv.fy) * 3));
  const k = band({ fx, fy });
  const below = band(topUV(s, cx, cy + 1));
  if (below !== null && below !== k) return 'n';
  const above = band(topUV(s, cx, cy - 1));
  if (above !== null && above !== k) return 'c';
  const n = (((Math.floor(cx) * 5 + Math.floor(cy) * 3) % 17) + 17) % 17;
  if (n === 0) return 't';
  return 'r';
}

/**
 * O ile pikseli w górę przedłużyć wstęgę drogi w rampach `e`/`s` (patrz `apron()`).
 * 0 = bez przedłużenia (tak wyglądały rampy przed playtestem „polish").
 */
const RAMP_APRON = 5;

/**
 * Podjazd („apron") dla ramp `e`/`s`: dosypana ziemia PRZED rampą, na kaflu niżej.
 *
 * Powód: z tych ramp widać wyłącznie 6-pikselowy pasek wzdłuż górnej krawędzi kafla.
 * Wszystko poniżej zasłania kafel „pod górę" (wierzch poziomu 1 podniesiony o ELEV_PX
 * nachodzi na diament rampy) — zmierzone zrzutem diagnostycznym: cały nasyp i ścianka
 * boczna są niewidoczne. Rozjaśnienie samego paska nie wystarczyło: z zoomu 2 rampa
 * czytała się jak przedłużenie rąbka krawędzi, a nie jak wjazd.
 *
 * Sprite rampy ma ELEV_PX zapasu nad diamentem (kafle N/W są rysowane WCZEŚNIEJ, więc
 * apron ich nie gubi) i tu go używamy: wstęga drogi rośnie o `RAMP_APRON` px w górę,
 * z 1-px ciemnym rąbkiem `o` na styku z trawą. Świadome odstępstwo od rzutu: podjazd
 * wychodzi poza własny kafel, ale kafel pod nim i tak jest przechodni, więc rysunek
 * nie kłamie o kolizjach — mówi „tędy się wjeżdża".
 */
function apron(rows: string[][]): void {
  const ROAD_CHARS = 'rctn';
  for (let sx = 0; sx < 32; sx += 1) {
    let top = -1;
    for (let sy = 0; sy < rows.length; sy += 1) {
      if (ROAD_CHARS.includes(rows[sy]![sx]!)) {
        top = sy;
        break;
      }
    }
    if (top < 0) continue;
    for (let d = 1; d <= RAMP_APRON; d += 1) {
      const sy = top - d;
      if (sy < 0) break;
      // ostatni rząd to ciemny rąbek na styku z trawą, reszta to ubita droga ze żwirem
      if (d === RAMP_APRON) rows[sy]![sx] = 'o';
      else rows[sy]![sx] = ((sx * 5 + sy * 3) % 17 === 0 ? 't' : 'r');
    }
  }
}

/**
 * Rampa 32×(16+ELEV_PX). Lewy-górny róg sprite'a w układzie kafla: (0, −ELEV_PX).
 *
 * Rampy `e` i `s` wznoszą się W STRONĘ kamery, więc ich wierzch jest skrajnie skrócony
 * perspektywicznie (96 px rzutu wobec 256 px diamentu przy ELEV_PX = 10) i sam nie pokrywa
 * całego kafla. Resztę diamentu domalowuje `fillBelow()` jako nasyp — to odsłonięta ściana
 * pod rampą. Nigdy nie jest to nadmiarowe malowanie: leży wewnątrz własnego diamentu kafla,
 * więc wszystko, co narysowane później (kafel „pod górę"), i tak to zasłania. Te dwie rampy
 * dostają dodatkowo `apron()` — bez niego zostaje z nich 6-pikselowa kreska.
 */
function rampGrid(up: UpDir): string[] {
  const s = RAMP_SLOPE[up];
  const side = RAMP_WALL_SIDE[up];
  const rows: string[][] = [];
  for (let sy = 0; sy < 16 + ELEV_PX; sy += 1) {
    const row: string[] = [];
    for (let sx = 0; sx < 32; sx += 1) {
      const cx = sx + 0.5;
      const cy = sy - ELEV_PX + 0.5;
      const uv = topUV(s, cx, cy);
      if (uv !== null) {
        row.push(roadChar(s, uv.fx, uv.fy, cx, cy));
        continue;
      }
      const hit = side === 's' ? wallS(s, cx, cy) : wallE(s, cx, cy);
      row.push(hit === null ? '.' : rockChar(hit, 'n'));
    }
    rows.push(row);
  }
  fillBelow(rows);
  if (up === 'e' || up === 's') apron(rows);
  return rows.map((row) => row.join(''));
}

/**
 * Domyka kolumny sprite'a rampy: każdy pusty piksel między już namalowanym pikselem
 * a dolną krawędzią diamentu kafla dostaje kamień (warstwy liczone od góry, kontur na dole).
 * Dzięki temu rampa nigdy nie zostawia dziury na styku poziomów.
 */
function fillBelow(rows: string[][]): void {
  const H = rows.length;
  for (let sx = 0; sx < 32; sx += 1) {
    let bottom = -1;
    for (let sy = 0; sy < H; sy += 1) if (inTile(sx, sy - ELEV_PX)) bottom = sy;
    if (bottom < 0) continue;
    let solidTop = -1;
    for (let sy = 0; sy <= bottom; sy += 1) {
      if (rows[sy]![sx] !== '.') {
        solidTop = sy;
        continue;
      }
      if (solidTop < 0) continue;
      rows[sy]![sx] = rockChar({ d: sy - solidTop, max: bottom - solidTop, t: sx / 32 }, 'n');
    }
  }
}

const terrain = {
  cliff_s: cliffGrid('s'),
  cliff_e: cliffGrid('e'),
  ledge_n: ledgeGrid('n'),
  ledge_w: ledgeGrid('w'),
  ramp_n: rampGrid('n'),
  ramp_e: rampGrid('e'),
  ramp_s: rampGrid('s'),
  ramp_w: rampGrid('w'),
};

const quote = (rows: string[]): string => rows.map((r) => `      '${r}',`).join('\n');

const tilesFile = `/**
 * WYGENEROWANE przez \`npx tsx scripts/gen-grids.ts\` — edytuj generator, nie ten plik.
 *
 * Kafle iso 32×16. Maska diamentu: \`|x-15.5|/16 + |y-7.5|/8 <= 1\` — sąsiednie kafle
 * przy offsecie (16, 8) stykają się bez dziur i bez nakładania (test: tests/assets/tiles.test.ts).
 * Podświetlenie górnej krawędzi (\`h\`) i przyciemnienie dolnej (\`d\`) dają głębię 2.5D (PLAN.md §6).
 *
 * \`tile_grass_hi{0,1,2}\` to te same siatki co \`tile_grass{0,1,2}\` w jaśniejszej palecie —
 * wierzch kafla na poziomie 1 (docs/architecture.md „Wywyższenia").
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

/**
 * Trawa poziomu 1 — każdy odcień o krok jaśniejszy niż \`GRASS\`. Ściany N/W płaskowyżu
 * są niewidoczne, więc sam wierzch musi nieść informację „to jest wyżej": jaśniejszy
 * kafel robi z płaskowyżu wyraźną „wyspę" nawet tam, gdzie krawędź jest za kadrem.
 * \`h\` == \`b\`, bo nad \`green\` nie ma już zieleni w EDG32 — górne krawędzie kafli
 * płaskowyżu są gładkie, a rysunek trzyma \`d\` (dolna krawędź) i kępki.
 */
const GRASS_HI = {
  b: PALETTE.green,
  h: PALETTE.green,
  d: PALETTE.midGreen,
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
${[0, 1, 2]
  .map(
    (i) => `
export const tile_grass_hi${i}: SpriteDef = sprite({
  name: 'tile_grass_hi${i}',
  anchor: ANCHOR_TILE,
  palette: GRASS_HI,
  frames: [
    [
${quote(GRASS_GRIDS[i]!)}
    ],
  ],
});`,
  )
  .join('\n')}

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

// ─────────────────────────────────────────────────────────────────────────────
// Głazy — rysowane ręcznie (to nie geometria): nieregularny owal, trzy odcienie
// szarości, ciemny kontur, przyciemniony spód-prawo (światło z góry-lewej) i mech
// u podstawy. `sprite()` pilnuje długości wierszy, więc literówka w siatce = błąd builda.
// ─────────────────────────────────────────────────────────────────────────────
const rocks = {
  rock_big: [
    '......oooo..........',
    '....oollggoo........',
    '...ollggssssoo......',
    '..olgggssssssoo.....',
    '.olggggsssssssddoo..',
    '.ogggggssssssssdddo.',
    'oggggggsssssssdddddo',
    'ogggggsssssssddddddo',
    'oggggssssssssddddddo',
    'ogggsssssssssddddddo',
    'oogsssssssssdddddddo',
    '.oossssssssdddddddoo',
    '..oosssssssdddddoo..',
    '...ooosssssdddddoo..',
    '....mmoooooooooo....',
    '.....mmooooooom.....',
  ],
  rock_small: [
    '...oooo.....',
    '..ollggo....',
    '.olgggssso..',
    'ogggssssddo.',
    'oggsssssddo.',
    'ogssssssdddo',
    '.osssssdddo.',
    '..oossdddo..',
    '..mooooooo..',
    '...moooom...',
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// Mur z auto-tilingiem: `wall_0` … `wall_15` + `wall_build`.
//
// Maska: 1 = N (krawędź górna-prawa), 2 = E (dolna-prawa), 4 = S (dolna-lewa),
// 8 = W (górna-lewa) — dokładnie `wallMask()` z `src/sim` (docs/architecture.md, Faza 2).
//
// Mur to bryła wyciągnięta pionowo z prostokątów w przestrzeni kafla (fx, fy):
//   słupek  — kwadrat w środku kafla (10 px szerokości na ekranie), wysokość WALL_POST_H,
//   segment — pasek od środka kafla do środka krawędzi (6 px), wysokość WALL_SEG_H.
// Rzut prostopadłościanu: piksel jest wypełniony, gdy dla pewnego h ∈ [0, H] punkt
// `invMap(px, py + h)` leży w prostokącie podstawy; widoczna powierzchnia to h = max
// (wierzch, gdy h = H, inaczej ściana E albo S — ściany N/W są tyłem do kamery).
//
// CIĄGŁOŚĆ: segment kończy się dokładnie na krawędzi kafla, a bit maski jest ustawiony
// tylko wtedy, gdy sąsiad też jest murem — więc przekrój na krawędzi zawsze ma po drugiej
// stronie bliźniaczy segment. Żeby na styku nie powstał ciemny kontur (ani dziura),
// sprite jest rasterizowany RAZEM z „duchami" segmentów sąsiadów, a kontur liczony
// z sumy obu masek; na końcu piksele duchów są kasowane.
// ─────────────────────────────────────────────────────────────────────────────

const WALL_W = 32;
const WALL_H = 32;
/** Wiersz sprite'a = wiersz kafla + WALL_BASE_Y. Dolny narożnik diamentu ląduje w ostatnim wierszu. */
const WALL_BASE_Y = 16;
/** Wysokość słupka i segmentu ponad ziemią (px, 1×). */
const WALL_POST_H = 18;
const WALL_SEG_H = 14;
/** Połowa boku podstawy w jednostkach kafla: słupek 10 px szerokości (64·a), segment 6 px (32·w). */
const WALL_POST_HALF = 5 / 32;
const WALL_SEG_HALF = 3 / 16;
/** Wysokość warstwy kamieni (px) — spoiny poziome co tyle, liczone od ziemi w górę. */
const WALL_COURSE = 5;

type WallBit = 'n' | 'e' | 's' | 'w';

/** Prostokąt podstawy (w jednostkach kafla) wyciągnięty na wysokość `h`. */
interface WallBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  h: number;
  /** Oś segmentu: wzdłuż fx (mur E–W), wzdłuż fy (mur N–S) albo słupek. */
  axis: 'x' | 'y' | 'post';
}

const WALL_POST_BOX: WallBox = {
  x0: 0.5 - WALL_POST_HALF,
  x1: 0.5 + WALL_POST_HALF,
  y0: 0.5 - WALL_POST_HALF,
  y1: 0.5 + WALL_POST_HALF,
  h: WALL_POST_H,
  axis: 'post',
};

/** Segment od środka kafla do środka krawędzi `bit`; `ghost` = ta sama połówka po drugiej stronie krawędzi. */
function wallSegBox(bit: WallBit, ghost: boolean): WallBox {
  const w = WALL_SEG_HALF;
  const near = ghost ? 1 : 0.5;
  const far = ghost ? 1.5 : 1;
  switch (bit) {
    case 'n':
      return { x0: 0.5 - w, x1: 0.5 + w, y0: 1 - far, y1: 1 - near, h: WALL_SEG_H, axis: 'y' };
    case 's':
      return { x0: 0.5 - w, x1: 0.5 + w, y0: near, y1: far, h: WALL_SEG_H, axis: 'y' };
    case 'e':
      return { x0: near, x1: far, y0: 0.5 - w, y1: 0.5 + w, h: WALL_SEG_H, axis: 'x' };
    default:
      return { x0: 1 - far, x1: 1 - near, y0: 0.5 - w, y1: 0.5 + w, h: WALL_SEG_H, axis: 'x' };
  }
}

/** Piksel (w układzie kafla) → punkt podstawy, na który patrzy kamera. Odwrotność rzutu iso. */
function wallInvMap(cx: number, cy: number): { fx: number; fy: number } {
  return { fx: (cx - 16) / 32 + cy / 16, fy: cy / 16 - (cx - 16) / 32 };
}

interface WallSurface {
  /** Wysokość widocznej powierzchni nad ziemią. */
  z: number;
  fx: number;
  fy: number;
  face: 'top' | 's' | 'e';
  box: WallBox;
}

/**
 * Najbliższa kamerze powierzchnia bryły w tym pikselu, albo `null`.
 * Rzut pionowego graniastosłupa = suma podstawy przesuniętej o h ∈ [0, H] w górę ekranu,
 * a widać powierzchnię o największym h (im wyżej, tym bliżej kamery).
 */
function wallHit(box: WallBox, cx: number, cy: number): WallSurface | null {
  const { fx, fy } = wallInvMap(cx, cy);
  const lo = Math.max(0, 16 * (box.x0 - fx), 16 * (box.y0 - fy));
  let hi = box.h;
  let face: 'top' | 's' | 'e' = 'top';
  const hE = 16 * (box.x1 - fx);
  const hS = 16 * (box.y1 - fy);
  if (hE < hi) {
    hi = hE;
    face = 'e';
  }
  if (hS < hi) {
    hi = hS;
    face = 's';
  }
  if (lo > hi) return null;
  return { z: hi, fx: fx + hi / 16, fy: fy + hi / 16, face, box };
}

/**
 * Kamienny wzór: poziome spoiny co `WALL_COURSE` px (liczone od ziemi, więc słupek i segmenty
 * mają je na tej samej wysokości) i pionowe spoiny co ćwierć kafla, przesunięte co drugą warstwę.
 * Litery: L = światło wierzchu, g = baza wierzchu i ściany S, s = spoina S i baza ściany E,
 * d = spoina ściany E.
 */
function wallChar(hit: WallSurface): string {
  const course = Math.floor(hit.z / WALL_COURSE);
  const t = hit.face === 'e' ? hit.fy : hit.fx;
  const along = hit.box.axis === 'x' ? hit.fx : hit.fy;
  const brick = (u: number, stagger: boolean): boolean => {
    const v = u * 4 + (stagger ? 0.5 : 0);
    return Math.abs(v - Math.round(v)) < 0.13;
  };
  if (hit.face === 'top') {
    // wierzch: poprzeczne spoiny wzdłuż osi muru; słupek dostaje własny, gęstszy rytm
    const joint = hit.box.axis === 'post' ? brick(hit.fx, false) || brick(hit.fy, false) : brick(along, false);
    return joint ? 'g' : 'L';
  }
  const joint = Math.floor(hit.z) % WALL_COURSE === WALL_COURSE - 1 || brick(t, course % 2 === 1);
  if (hit.face === 's') return joint ? 's' : 'g';
  return joint ? 'd' : 's';
}

/** Wypełnia siatkę bryłami w kolejności malarskiej (od najdalszej do najbliższej kamery). */
function wallPaint(boxes: WallBox[], grid: (string | null)[][], ox: number, oy: number): void {
  const order = [...boxes].sort((a, b) => a.x1 + a.y1 - (b.x1 + b.y1));
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row]!.length; col += 1) {
      const cx = col - ox + 0.5;
      const cy = row - oy + 0.5;
      for (const box of order) {
        const hit = wallHit(box, cx, cy);
        if (hit !== null) grid[row]![col] = wallChar(hit);
      }
    }
  }
}

/** Margines rasteryzacji: duchy sąsiadów wychodzą poza sprite, a kontur liczymy z nich. */
const WALL_PAD = 12;

function wallGrid(mask: number): string[] {
  const bits: Array<[number, WallBit]> = [
    [1, 'n'],
    [2, 'e'],
    [4, 's'],
    [8, 'w'],
  ];
  const own: WallBox[] = [WALL_POST_BOX];
  const ghosts: WallBox[] = [];
  for (const [bit, dir] of bits) {
    if ((mask & bit) === 0) continue;
    own.push(wallSegBox(dir, false));
    ghosts.push(wallSegBox(dir, true));
  }

  const H = WALL_H + 2 * WALL_PAD;
  const W = WALL_W + 2 * WALL_PAD;
  const blank = (): (string | null)[][] =>
    Array.from({ length: H }, () => new Array<string | null>(W).fill(null));

  // maska „wszystko" (mur + duchy sąsiadów) — po niej liczymy kontur, żeby na styku kafli go nie było
  const all = blank();
  wallPaint([...ghosts, ...own], all, WALL_PAD, WALL_PAD + WALL_BASE_Y);
  // maska własna — tylko ta, co trafi do sprite'a
  const mine = blank();
  wallPaint(own, mine, WALL_PAD, WALL_PAD + WALL_BASE_Y);

  const rows: string[] = [];
  for (let sy = 0; sy < WALL_H; sy += 1) {
    let row = '';
    for (let sx = 0; sx < WALL_W; sx += 1) {
      const r = sy + WALL_PAD;
      const c = sx + WALL_PAD;
      const ch = mine[r]![c];
      if (ch === null) {
        row += '.';
        continue;
      }
      const edge =
        all[r - 1]![c] === null || all[r + 1]![c] === null || all[r]![c - 1] === null || all[r]![c + 1] === null;
      row += edge ? 'o' : ch;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * `wall_build` — ten sam słupek, ale jako drewniane rusztowanie: pełny pomost na górze,
 * dwie deski niżej i pionowe słupki w narożnikach, między nimi prześwity (render dokłada alfę).
 * Bez segmentów: mur w budowie nie łączy się jeszcze z sąsiadami.
 */
function wallBuildGrid(): string[] {
  const H = WALL_H + 2 * WALL_PAD;
  const W = WALL_W + 2 * WALL_PAD;
  const grid: (string | null)[][] = Array.from({ length: H }, () => new Array<string | null>(W).fill(null));
  const box = WALL_POST_BOX;
  for (let row = 0; row < H; row += 1) {
    for (let col = 0; col < W; col += 1) {
      const cx = col - WALL_PAD + 0.5;
      const cy = row - (WALL_PAD + WALL_BASE_Y) + 0.5;
      const hit = wallHit(box, cx, cy);
      if (hit === null) continue;
      if (hit.face === 'top') {
        grid[row]![col] = 'T';
        continue;
      }
      const t = hit.face === 'e' ? hit.fy : hit.fx;
      const end = Math.min(Math.abs(t - (box.x0 + 0)), Math.abs(t - box.x1)) < 0.035;
      const plank = hit.z % 6 < 3.2;
      if (!end && !plank) continue;
      grid[row]![col] = hit.face === 's' ? (plank && !end ? 'l' : 'b') : plank && !end ? 'b' : 'o';
    }
  }
  const rows: string[] = [];
  for (let sy = 0; sy < WALL_H; sy += 1) {
    let row = '';
    for (let sx = 0; sx < WALL_W; sx += 1) {
      row += grid[sy + WALL_PAD]![sx + WALL_PAD] ?? '.';
    }
    rows.push(row);
  }
  return rows;
}

const walls: Record<string, string[]> = {};
for (let mask = 0; mask < 16; mask += 1) walls[`wall_${mask}`] = wallGrid(mask);
walls['wall_build'] = wallBuildGrid();

const terrainFile = `/**
 * WYGENEROWANE przez \`npx tsx scripts/gen-grids.ts\` — edytuj generator, nie ten plik.
 *
 * Teren wywyższony (docs/architecture.md „Wywyższenia (elewacja)"):
 *  - \`cliff_s\`, \`cliff_e\` — ściany klifu 16×(8+ELEV_PX), leżą WEWNĄTRZ nieprzesuniętego
 *    diamentu kafla (od krawędzi wierzchu podniesionego o ELEV_PX w dół do gruntu);
 *  - \`ramp_{n|e|s|w}\` — 32×(16+ELEV_PX): pochyły wierzch + widoczna ścianka boczna;
 *  - \`ledge_n\`, \`ledge_w\` — 16×${terrain.ledge_n.length} rąbek górnej krawędzi wierzchu (ściany N/W
 *    są niewidoczne, więc bez rąbka płaskowyż zlewa się z gruntem za nim);
 *  - \`rock_small\`, \`rock_big\` — głazy, kotwica u podstawy.
 *
 * Pozycjonowanie względem \`gridToScreen(gx, gy)\` wynika wprost z \`pivot\` w atlasie:
 *   cliff_s: left = screenX − 16, top = screenY − ELEV_PX
 *   cliff_e: left = screenX,      top = screenY − ELEV_PX
 *   ramp_*:  left = screenX − 16, top = screenY − (8 + ELEV_PX)
 *   ledge_n: left = screenX,      top = screenY − 8
 *   ledge_w: left = screenX − 16, top = screenY − 8
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_FOOT, sprite, type Anchor, type SpriteDef } from './sprite.ts';

/** MUSI być równe \`ELEV_PX\` z \`src/sim/balance.ts\` (assets nie importuje z src). */
export const ELEV_PX = ${ELEV_PX};

/** Wysokość sprite'a ściany klifu i rampy. */
const CLIFF_H = 8 + ELEV_PX; // ${8 + ELEV_PX}
const RAMP_H = 16 + ELEV_PX; // ${16 + ELEV_PX}

/** Prawy-dolny narożnik sprite'a siedzi w dolnym narożniku kafla → left = screenX − 16. */
const ANCHOR_CLIFF_S: Anchor = { x: 1, y: ELEV_PX / CLIFF_H }; // ${(ELEV_PX / (8 + ELEV_PX)).toFixed(6)}
/** Lustrzanie: lewy brzeg sprite'a w dolnym narożniku kafla → left = screenX. */
const ANCHOR_CLIFF_E: Anchor = { x: 0, y: ELEV_PX / CLIFF_H };
/** Dolny (nieprzesunięty) diament rampy pokrywa kafel → top = screenY − (8 + ELEV_PX). */
const ANCHOR_RAMP: Anchor = { x: 0.5, y: (8 + ELEV_PX) / RAMP_H }; // ${((8 + ELEV_PX) / (16 + ELEV_PX)).toFixed(6)}

/** Wysokość rąbka krawędzi: górna połowa kafla + zapas na cień pod sylwetką. */
const LEDGE_H = ${terrain.ledge_n.length};
/** Rąbek N zajmuje prawą połowę górnej części kafla → left = screenX. */
const ANCHOR_LEDGE_N: Anchor = { x: 0, y: 8 / LEDGE_H }; // ${(8 / terrain.ledge_n.length).toFixed(6)}
/** Rąbek W zajmuje lewą połowę → left = screenX − 16. */
const ANCHOR_LEDGE_W: Anchor = { x: 1, y: 8 / LEDGE_H };

/**
 * Skała ściany S (jaśniejsza — światło z góry-lewej pada na ścianę zwróconą w +gy).
 * g = trawiasty rąbek pod wierzchem, l = światło, b = baza, d = cień, o = kontur.
 */
const ROCK_S = {
  g: PALETTE.darkGreen,
  l: PALETTE.slate,
  b: PALETTE.darkSlate,
  d: PALETTE.navy,
  o: PALETTE.black,
};

/** Skała ściany E — każdy odcień o jeden krok ciemniejszy niż w \`ROCK_S\`. */
const ROCK_E = {
  g: PALETTE.darkTeal,
  l: PALETTE.darkSlate,
  b: PALETTE.navy,
  d: PALETTE.navy,
  o: PALETTE.black,
};

/**
 * Nasyp rampy: ubita ZIEMIA, nie skała — rampa jest usypana, a nie wykuta.
 * Po playteście rozjaśniony o dwa kroki (\`clay\`/\`leather\` zamiast \`brown\`/\`darkBrown\`):
 * ciemny nasyp czytał się jako dziura w zboczu, a nie jako podjazd. Dolny 1 px to
 * \`darkBrown\` (a nie \`black\` jak w klifie) — rampa ma odcinać się od ziemi, ale nie
 * wyglądać jak wykuty blok.
 */
const RAMP_WALL = {
  g: PALETTE.brown,
  l: PALETTE.clay,
  b: PALETTE.leather,
  d: PALETTE.brown,
  o: PALETTE.darkBrown,
};

/**
 * Wierzch rampy: jasna, piaszczysta droga. r = baza, c = nos stopnia (światło),
 * t = żwir, n = podstopnica i rąbek. Rozjaśnione po playteście (\`tan\`/\`cream\`
 * zamiast \`leather\`/\`clay\`): wstęga drogi to główny sygnał „tędy się wjeżdża",
 * więc musi być najjaśniejszym elementem terenu, także na zoomie 2.
 */
const ROAD = {
  r: PALETTE.tan,
  c: PALETTE.cream,
  t: PALETTE.clay,
  n: PALETTE.brown,
};

/**
 * Rąbek górnej krawędzi płaskowyżu: h = 1 px światła na samej sylwetce,
 * s = cień pod nim (ta sama zieleń, co rąbek pod wierzchem na ścianie klifu S).
 */
const LEDGE = {
  h: PALETTE.cream,
  s: PALETTE.darkGreen,
};

/**
 * Głaz: l = błysk, g/s/d = trzy odcienie bryły (światło z góry-lewej), o = kontur, m = mech.
 * Ta sama drabina wartości co ściany klifu — głaz ma być z tej samej skały co płaskowyż.
 */
const ROCK = {
  l: PALETTE.lightGrey,
  g: PALETTE.slate,
  s: PALETTE.darkSlate,
  d: PALETTE.navy,
  o: PALETTE.black,
  m: PALETTE.darkGreen,
};

export const cliff_s: SpriteDef = sprite({
  name: 'cliff_s',
  anchor: ANCHOR_CLIFF_S,
  palette: ROCK_S,
  frames: [
    [
${quote(terrain.cliff_s)}
    ],
  ],
});

export const cliff_e: SpriteDef = sprite({
  name: 'cliff_e',
  anchor: ANCHOR_CLIFF_E,
  palette: ROCK_E,
  frames: [
    [
${quote(terrain.cliff_e)}
    ],
  ],
});

export const ledge_n: SpriteDef = sprite({
  name: 'ledge_n',
  anchor: ANCHOR_LEDGE_N,
  palette: LEDGE,
  frames: [
    [
${quote(terrain.ledge_n)}
    ],
  ],
});

export const ledge_w: SpriteDef = sprite({
  name: 'ledge_w',
  anchor: ANCHOR_LEDGE_W,
  palette: LEDGE,
  frames: [
    [
${quote(terrain.ledge_w)}
    ],
  ],
});
${(['n', 'e', 's', 'w'] as const)
  .map(
    (d) => `
export const ramp_${d}: SpriteDef = sprite({
  name: 'ramp_${d}',
  anchor: ANCHOR_RAMP,
  palette: { ...ROAD, ...RAMP_WALL },
  frames: [
    [
${quote(terrain[`ramp_${d}`])}
    ],
  ],
});`,
  )
  .join('\n')}

export const rock_big: SpriteDef = sprite({
  name: 'rock_big',
  anchor: ANCHOR_FOOT,
  palette: ROCK,
  frames: [
    [
${quote(rocks.rock_big)}
    ],
  ],
});

export const rock_small: SpriteDef = sprite({
  name: 'rock_small',
  anchor: ANCHOR_FOOT,
  palette: ROCK,
  frames: [
    [
${quote(rocks.rock_small)}
    ],
  ],
});
`;


const wallsFile = `/**
 * WYGENEROWANE przez \`npx tsx scripts/gen-grids.ts\` — edytuj generator, nie ten plik.
 *
 * Mur z auto-tilingiem (docs/architecture.md, Faza 2): \`wall_0\` … \`wall_15\`, indeks = maska
 * N|E|S|W (1|2|4|8) sąsiednich murów. N = krawędź górna-prawa kafla, E = dolna-prawa,
 * S = dolna-lewa, W = górna-lewa.
 *
 * Płótno ${WALL_W}×${WALL_H}: dolne 16 wierszy to dokładnie bounding box diamentu kafla,
 * górne ${WALL_BASE_Y} to zapas na wysokość muru. Kotwica (pivot) = ŚRODEK KAFLA, czyli
 * \`{ x: 0.5, y: ${WALL_BASE_Y + 8} / ${WALL_H} }\` = { 0.5, ${((WALL_BASE_Y + 8) / WALL_H).toFixed(4)} }:
 *   left = screenX(środek kafla) − 16
 *   top  = screenY(środek kafla) − ${WALL_BASE_Y + 8}
 * (na wywyższeniu jeszcze \`− elevation × ELEV_PX\`, jak wszystkie propy).
 *
 * Geometria: słupek ${WALL_POST_H} px nad ziemią, podstawa ${(64 * WALL_POST_HALF).toFixed(0)} px szerokości na ekranie;
 * segment do środka krawędzi — ${WALL_SEG_H} px wysokości, ${(32 * WALL_SEG_HALF).toFixed(0)} px szerokości.
 * Segment kończy się DOKŁADNIE na krawędzi kafla, a kontur na styku jest pominięty
 * (liczony z sumy muru i „duchów" sąsiadów), więc sąsiednie kafle sklejają się w ciągłą ścianę
 * — pilnuje tego \`tests/assets/walls.test.ts\`.
 */
import { PALETTE } from './palette.ts';
import { sprite, type Anchor, type SpriteDef } from './sprite.ts';

/** Środek kafla leży ${WALL_BASE_Y + 8} px od góry sprite'a (8 px nad dolną krawędzią diamentu). */
export const ANCHOR_WALL: Anchor = { x: 0.5, y: ${WALL_BASE_Y + 8} / ${WALL_H} };

/**
 * Kamień: L = światło wierzchu, g = baza wierzchu / ściana S, s = spoina S / baza ściany E,
 * d = spoina ściany E, o = kontur. Ściana S (zwrócona w +gy, ekranowo dół-lewo) jest jaśniejsza
 * od E (+gx, dół-prawo) — to ta sama reguła światła, co w ścianach klifu.
 *
 * Kontur to \`navy\`, nie \`darkSlate\`: \`darkSlate\` jest już spoiną ściany E, a kontur musi być
 * o krok ciemniejszy od najciemniejszej ściany — inaczej sylwetka muru ginie na tle ściany E
 * i nie da się odróżnić fugi od szwu między kaflami (patrz \`tests/assets/walls.test.ts\`).
 */
const STONE = {
  L: PALETTE.lightGrey,
  g: PALETTE.grey,
  s: PALETTE.slate,
  d: PALETTE.darkSlate,
  o: PALETTE.navy,
};

/** Rusztowanie: T = pomost, l = deska oświetlona, b = deska w cieniu, o = słupek/kontur. */
const SCAFFOLD = {
  T: PALETTE.tan,
  l: PALETTE.leather,
  b: PALETTE.brown,
  o: PALETTE.darkBrown,
};
${Array.from({ length: 16 }, (_, mask) => `
export const wall_${mask}: SpriteDef = sprite({
  name: 'wall_${mask}',
  anchor: ANCHOR_WALL,
  palette: STONE,
  frames: [
    [
${quote(walls[`wall_${mask}`]!)}
    ],
  ],
});`).join('\n')}

/** Mur w budowie: drewniane rusztowanie bez segmentów (render używa go z alfą). */
export const wall_build: SpriteDef = sprite({
  name: 'wall_build',
  anchor: ANCHOR_WALL,
  palette: SCAFFOLD,
  frames: [
    [
${quote(walls['wall_build']!)}
    ],
  ],
});

/** \`wall_0\` … \`wall_15\` w kolejności maski — indeks = N|E|S|W (1|2|4|8). */
export const WALL_FRAMES: readonly SpriteDef[] = [
${Array.from({ length: 16 }, (_, m) => `  wall_${m},`).join('\n')}
];
`;

await writeFile(join(SRC_DIR, 'tiles.ts'), tilesFile, 'utf8');
await writeFile(join(SRC_DIR, 'nature.ts'), natureFile, 'utf8');
await writeFile(join(SRC_DIR, 'terrain.ts'), terrainFile, 'utf8');
await writeFile(join(SRC_DIR, 'walls.ts'), wallsFile, 'utf8');
console.log('gen-grids: assets/src/tiles.ts, assets/src/nature.ts, assets/src/terrain.ts, assets/src/walls.ts');
