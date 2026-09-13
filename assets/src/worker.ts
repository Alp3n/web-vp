/**
 * Robotnik — 16×24 (sylwetka ~14×22), 4 kierunki ISO, anchor = stopa.
 *
 * Rysowane ręcznie są tylko SE (przód, w stronę kamery-prawo) i NE (tył, od kamery-prawo).
 * SW i NW powstają przez `flipX` (PLAN.md §6: „Kierunki: 4, pozostałe przez flip"),
 * ale w atlasie istnieją wszystkie cztery nazwy.
 *
 * Klatka = tułów (16 rzędów, y0..y15) nałożony na nogi (8 rzędów, y16..y23).
 * „Bujanie" o 1 px to przesunięcie tułowia w dół — w klatkach kontaktowych chodu
 * i w wydechu bezruchu. Hem tuniki zakrywa wtedy górę nóg (naturalne ściśnięcie).
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_FOOT, flipX, sprite, type SpriteDef } from './sprite.ts';

const WIDTH = 16;
const BODY_H = 16;
const LEGS_Y = 16;
const HEIGHT = 24;

/**
 * k/K/L — czapka z daszkiem (chłodny granat odcina się od brązów i zieleni),
 * s/S — skóra, e — oko, T/t/u — tunika (jasna/baza/cień), b — pas i noga w tyle,
 * m — noga z przodu, n — but, w — jasny trzonek siekiery, a/A — ostrze.
 */
const WORKER_PALETTE = {
  k: PALETTE.navy,
  K: PALETTE.darkSlate,
  L: PALETTE.slate,
  e: PALETTE.black,
  s: PALETTE.skin,
  S: PALETTE.skinShade,
  T: PALETTE.tan,
  t: PALETTE.leather,
  u: PALETTE.brown,
  b: PALETTE.darkBrown,
  m: PALETTE.brown,
  n: PALETTE.black,
  w: PALETTE.tan,
  a: PALETTE.grey,
  A: PALETTE.lightGrey,
};

// kolumny: 0123456789012345
const BODY_SE = [
  '................',
  '............aa..',
  '......kKKk..aAa.',
  '.....kKLLKk.aAa.',
  '....kkKKKKkkaa..',
  '.....SssesS.w...',
  '......SssS..w...',
  '.....TTttuu.w...',
  '....TTttttuuw...',
  '....Ttttttuuw...',
  '....Ttttttuuw...',
  '....Ttttttusw...',
  '....sttttttsw...',
  '....bbbbbbbb....',
  '....Tttttttu....',
  '....uuuuuuuu....',
];

const BODY_NE = [
  '................',
  '............aa..',
  '......kKKk..aAa.',
  '.....kKLLKk.aAa.',
  '....kkKKKKkkaa..',
  '.....kKKKKk.w...',
  '......SSSS..w...',
  '.....TTttuu.w...',
  '....TTtbbtuuw...',
  '....Ttttbbuuw...',
  '....Tttttbbuw...',
  '....Ttttttusw...',
  '....sttttttsw...',
  '....bbbbbbbb....',
  '....Tttttttu....',
  '....uuuuuuuu....',
];

const LEGS_STAND = [
  '.....mm..bb.....',
  '.....mm..bb.....',
  '.....mm..bb.....',
  '.....mm..bb.....',
  '.....mm..bb.....',
  '.....mm..bb.....',
  '....nnn..nnn....',
  '....nnn..nnn....',
];

/** Kontakt: nogi w rozkroku; noga wykroczna (m) jasniejsza, zakroczna (b) ciemniejsza. */
const LEGS_CONTACT_A = [
  '.....bb..mm.....',
  '.....bb..mm.....',
  '....bb....mm....',
  '....bb....mm....',
  '...bb......mm...',
  '...bb......mm...',
  '..nnn......nnn..',
  '..nnn......nnn..',
];

const LEGS_CONTACT_B = [
  '.....mm..bb.....',
  '.....mm..bb.....',
  '....mm....bb....',
  '....mm....bb....',
  '...mm......bb...',
  '...mm......bb...',
  '..nnn......nnn..',
  '..nnn......nnn..',
];

/** Przejscie: jedna noga pod tulowiem, druga uniesiona (but w powietrzu). */
const LEGS_PASS_A = [
  '.....mm..bb.....',
  '.....mm..bb.....',
  '.....mm.bb......',
  '......mmbb......',
  '......mmnnn.....',
  '......mm........',
  '.....nnn........',
  '.....nnn........',
];

const LEGS_PASS_B = [
  '.....mm..bb.....',
  '.....mm..bb.....',
  '......mm.bb.....',
  '......mmbb......',
  '.....nnnbb......',
  '........bb......',
  '........nnn.....',
  '........nnn.....',
];

const EMPTY_ROW = '.'.repeat(WIDTH);

/** Nakłada `layer` na `base` od rzędu `top`; znak `.` w warstwie nie zamazuje tła. */
function overlay(base: string[], layer: readonly string[], top: number): string[] {
  const out = [...base];
  layer.forEach((row, i) => {
    const y = top + i;
    const target = out[y];
    if (target === undefined) return;
    let merged = '';
    for (let x = 0; x < WIDTH; x += 1) {
      const src = row[x] ?? '.';
      merged += src === '.' ? (target[x] ?? '.') : src;
    }
    out[y] = merged;
  });
  return out;
}

/** Klatka = nogi + tułów przesunięty o `bob` px w dół. */
function pose(body: readonly string[], legs: readonly string[], bob: 0 | 1): string[] {
  const blank: string[] = new Array<string>(HEIGHT).fill(EMPTY_ROW);
  return overlay(overlay(blank, legs, LEGS_Y), body, bob);
}

function workerSprite(name: string, body: readonly string[], frames: Array<[readonly string[], 0 | 1]>): SpriteDef {
  return sprite({
    name,
    anchor: ANCHOR_FOOT,
    palette: WORKER_PALETTE,
    frames: frames.map(([legs, bob]) => pose(body, legs, bob)),
  });
}

if (BODY_SE.length !== BODY_H || BODY_NE.length !== BODY_H) {
  throw new Error('worker.ts: tułów musi mieć dokładnie 16 rzędów');
}

const idleFrames: Array<[readonly string[], 0 | 1]> = [
  [LEGS_STAND, 0],
  [LEGS_STAND, 1],
];

const walkFrames: Array<[readonly string[], 0 | 1]> = [
  [LEGS_CONTACT_A, 1],
  [LEGS_PASS_A, 0],
  [LEGS_CONTACT_B, 1],
  [LEGS_PASS_B, 0],
];

export const worker_idle_se = workerSprite('worker_idle_se', BODY_SE, idleFrames);
export const worker_idle_ne = workerSprite('worker_idle_ne', BODY_NE, idleFrames);
export const worker_walk_se = workerSprite('worker_walk_se', BODY_SE, walkFrames);
export const worker_walk_ne = workerSprite('worker_walk_ne', BODY_NE, walkFrames);

export const worker_idle_sw = flipX(worker_idle_se, 'worker_idle_sw');
export const worker_idle_nw = flipX(worker_idle_ne, 'worker_idle_nw');
export const worker_walk_sw = flipX(worker_walk_se, 'worker_walk_sw');
export const worker_walk_nw = flipX(worker_walk_ne, 'worker_walk_nw');
