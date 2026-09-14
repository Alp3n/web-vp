/**
 * Typy i helpery symulacji (kontrakt: `docs/architecture.md` — sekcje „Kierunki" i „src/sim").
 * Pozycje są w kaflach (float) w przestrzeni siatki, nie w pikselach ekranu.
 */

import { BALANCE } from './balance';

export type EntityId = number;

export interface Vec2 {
  x: number;
  y: number;
}

/** Kierunki w przestrzeni siatki: N = -y, E = +x. */
export type Dir8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIR_N = 0 as const;
export const DIR_NE = 1 as const;
export const DIR_E = 2 as const;
export const DIR_SE = 3 as const;
export const DIR_S = 4 as const;
export const DIR_SW = 5 as const;
export const DIR_W = 6 as const;
export const DIR_NW = 7 as const;

/** Składowa przekątnej (1/sqrt(2)) — stała, żeby hash stanu był powtarzalny. */
export const DIAGONAL = 0.70710678;

/** Znormalizowane wektory kierunków; indeks = `Dir8`. */
export const DIR_VECTORS: Record<Dir8, Vec2> = {
  0: { x: 0, y: -1 },
  1: { x: DIAGONAL, y: -DIAGONAL },
  2: { x: 1, y: 0 },
  3: { x: DIAGONAL, y: DIAGONAL },
  4: { x: 0, y: 1 },
  5: { x: -DIAGONAL, y: DIAGONAL },
  6: { x: -1, y: 0 },
  7: { x: -DIAGONAL, y: -DIAGONAL },
};

/** Kafle: 0/1/2 = warianty trawy, 3 = ziemia, 4 = woda (blokuje). */
export type TileKind = 0 | 1 | 2 | 3 | 4;

export const TILE_GRASS0 = 0 as const;
export const TILE_GRASS1 = 1 as const;
export const TILE_GRASS2 = 2 as const;
export const TILE_DIRT = 3 as const;
export const TILE_WATER = 4 as const;

export interface Tree {
  id: EntityId;
  x: number;
  y: number;
  wood: number;
  state: 'full' | 'chopped' | 'stump';
}

/**
 * Kierunek rampy = kierunek POD GÓRĘ w przestrzeni siatki.
 * 0 = brak rampy, 1 = N (-y), 2 = E (+x), 3 = S (+y), 4 = W (-x).
 */
export type RampDir = 0 | 1 | 2 | 3 | 4;

export const RAMP_NONE = 0 as const;
export const RAMP_N = 1 as const;
export const RAMP_E = 2 as const;
export const RAMP_S = 3 as const;
export const RAMP_W = 4 as const;

/** Głaz: statyczny bloker (jak drzewo), `size` tylko do wyboru sprite'a. */
export interface Rock {
  id: EntityId;
  x: number;
  y: number;
  size: 0 | 1;
}

export interface Unit {
  id: EntityId;
  kind: 'worker' | 'vampire';
  pos: Vec2;
  vel: Vec2;
  facing: Dir8;
  moving: boolean;
  hp: number;
  maxHp: number;
  speed: number;
}

export interface World {
  seed: number;
  tick: number;
  width: number;
  height: number;
  /** `TileKind`, indeks = y * width + x. */
  tiles: Uint8Array;
  /** 1 = statycznie zablokowane (drzewo, woda, głaz). */
  blocked: Uint8Array;
  /** Poziom terenu 0|1 per kafel, indeks = y * width + x. */
  elevation: Uint8Array;
  /** `RampDir` per kafel: 0 = brak rampy, 1..4 = kierunek pod górę. */
  ramp: Uint8Array;
  trees: Tree[];
  rocks: Rock[];
  units: Unit[];
  wood: number;
  gold: number;
  nextId: EntityId;
  /** Stan mulberry32 (`rngNext`). */
  rng: { state: number };
}

const DIR_MIN_LENGTH_SQ = BALANCE.sim.dirMinLength * BALANCE.sim.dirMinLength;
const QUARTER_PI = Math.PI / 4;

/**
 * Snap dowolnego wektora (w przestrzeni siatki) do jednego z 8 kierunków.
 * Zwraca `null`, gdy wektor jest krótszy niż `BALANCE.sim.dirMinLength` (martwa strefa joysticka).
 */
export function dirFromVector(dx: number, dy: number): Dir8 | null {
  if (dx * dx + dy * dy < DIR_MIN_LENGTH_SQ) return null;
  // atan2(dx, -dy): 0 = N, +PI/2 = E — zgodnie z numeracją Dir8.
  const sector = Math.round(Math.atan2(dx, -dy) / QUARTER_PI);
  return (((sector % 8) + 8) % 8) as Dir8;
}

/** Indeks kafla dla współrzędnych świata; -1 poza mapą. */
export function tileIndex(world: World, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return -1;
  return ty * world.width + tx;
}

/** Czy kafel blokuje ruch. Poza mapą = zablokowane. */
export function isBlocked(world: World, x: number, y: number): boolean {
  const idx = tileIndex(world, x, y);
  if (idx < 0) return true;
  return world.blocked[idx] === 1;
}

/** Kafel o współrzędnych (x, y) → drzewo albo `undefined`. */
export function treeAt(world: World, x: number, y: number): Tree | undefined {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (const tree of world.trees) {
    if (tree.x === tx && tree.y === ty) return tree;
  }
  return undefined;
}

/** Kafel o współrzędnych (x, y) → głaz albo `undefined`. */
export function rockAt(world: World, x: number, y: number): Rock | undefined {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (const rock of world.rocks) {
    if (rock.x === tx && rock.y === ty) return rock;
  }
  return undefined;
}

/** Jednostka po id albo `undefined`. */
export function unitById(world: World, id: EntityId): Unit | undefined {
  for (const unit of world.units) {
    if (unit.id === id) return unit;
  }
  return undefined;
}
