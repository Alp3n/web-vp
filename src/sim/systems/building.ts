/**
 * Budowanie (kontrakt: `docs/architecture.md`, sekcja „Faza 2 — ekonomia i budowanie").
 *
 * `canPlaceBuilding` jest wołane przez tryb budowy przy KAŻDYM ruchu palca (~60×/s),
 * więc nie alokuje: wyniki to zamrożone stałe modułu (`OK` i jeden obiekt na powód),
 * a sprawdzenia idą po kaflach footprintu (max 2×2) i po jednostkach — bez tablic
 * pośrednich i bez domknięć.
 */

import { BALANCE, UNIT_RADIUS } from '../balance';
import type { Command } from '../commands';
import type { Building, BuildingKind, World } from '../types';
import { tileIndex, unitById } from '../types';

const BUILD = BALANCE.build;
const KINDS = BALANCE.buildings;

/** Powody odrzucenia (po polsku — render pokazuje je pod duchem budynku). */
export type PlacementReason =
  | 'brak drewna'
  | 'poza zasięgiem'
  | 'zajęte'
  | 'rampa'
  | 'klif'
  | 'jednostka'
  | 'poza mapą'
  | 'niedostępne w tej fazie';

export interface PlacementResult {
  readonly ok: boolean;
  readonly reason?: PlacementReason;
}

const OK: PlacementResult = Object.freeze({ ok: true });
/** Po jednym gotowym obiekcie na powód — zero alokacji w gorącej ścieżce. */
const FAIL: Readonly<Record<PlacementReason, PlacementResult>> = Object.freeze({
  'brak drewna': Object.freeze({ ok: false, reason: 'brak drewna' as const }),
  'poza zasięgiem': Object.freeze({ ok: false, reason: 'poza zasięgiem' as const }),
  zajęte: Object.freeze({ ok: false, reason: 'zajęte' as const }),
  rampa: Object.freeze({ ok: false, reason: 'rampa' as const }),
  klif: Object.freeze({ ok: false, reason: 'klif' as const }),
  jednostka: Object.freeze({ ok: false, reason: 'jednostka' as const }),
  'poza mapą': Object.freeze({ ok: false, reason: 'poza mapą' as const }),
  'niedostępne w tej fazie': Object.freeze({ ok: false, reason: 'niedostępne w tej fazie' as const }),
});

/** Rozmiar footprintu budynku w kaflach. */
export function footprintOf(kind: BuildingKind): { w: number; h: number } {
  return KINDS[kind].footprint;
}

/** Koszt w drewnie. */
export function woodCostOf(kind: BuildingKind): number {
  return KINDS[kind].woodCost;
}

/** Czy rodzaj budynku jest dostępny w tej fazie (wieża i generator: Faza 4). */
export function isKindAvailable(kind: string): kind is BuildingKind {
  return (BUILD.availableKinds as readonly string[]).includes(kind);
}

/** Budynek zajmujący kafel (x, y) albo `undefined`. */
export function buildingAt(world: World, x: number, y: number): Building | undefined {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b;
  }
  return undefined;
}

function isWallAt(world: World, x: number, y: number): boolean {
  return buildingAt(world, x, y)?.kind === 'wall';
}

/**
 * Maska auto-tilingu muru dla kafla: bit 1 = N (x, y-1), 2 = E (x+1, y),
 * 4 = S (x, y+1), 8 = W (x-1, y) — ustawiony, gdy sąsiedni kafel też jest murem.
 * Render używa jej jako indeksu klatki `wall_{mask}`.
 */
export function wallMask(world: World, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  let mask = 0;
  if (isWallAt(world, tx, ty - 1)) mask |= 1;
  if (isWallAt(world, tx + 1, ty)) mask |= 2;
  if (isWallAt(world, tx, ty + 1)) mask |= 4;
  if (isWallAt(world, tx - 1, ty)) mask |= 8;
  return mask;
}

/** Kwadrat odległości punktu od najbliższego kafla footprintu (liczony do środków kafli). */
function distSqToFootprint(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  let best = Infinity;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const dx = tx + 0.5 - px;
      const dy = ty + 0.5 - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
  }
  return best;
}

/** Czy okrąg jednostki (r = `UNIT_RADIUS`) zachodzi na prostokąt footprintu. */
function unitOverlapsFootprint(
  ux: number,
  uy: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const nearestX = ux < x ? x : ux > x + w ? x + w : ux;
  const nearestY = uy < y ? y : uy > y + h ? y + h : uy;
  const dx = ux - nearestX;
  const dy = uy - nearestY;
  return dx * dx + dy * dy < UNIT_RADIUS * UNIT_RADIUS;
}

/**
 * Czy jednostka `unitId` może postawić budynek `kind` z lewym-górnym kaflem (x, y).
 * Kolejność sprawdzeń = kolejność warunków w kontrakcie; pierwszy niespełniony daje `reason`.
 * Brak jednostki o podanym id traktujemy jak „poza zasięgiem" (nie ma kto budować).
 */
export function canPlaceBuilding(
  world: World,
  unitId: number,
  kind: string,
  x: number,
  y: number,
): PlacementResult {
  if (!isKindAvailable(kind)) return FAIL['niedostępne w tej fazie'];
  if (world.wood < woodCostOf(kind)) return FAIL['brak drewna'];

  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const { w, h } = footprintOf(kind);
  if (tx < 0 || ty < 0 || tx + w > world.width || ty + h > world.height) return FAIL['poza mapą'];

  const baseIdx = tileIndex(world, tx, ty);
  const baseElev = world.elevation[baseIdx] ?? 0;
  for (let cy = ty; cy < ty + h; cy++) {
    for (let cx = tx; cx < tx + w; cx++) {
      const idx = cy * world.width + cx;
      if (world.blocked[idx] === 1) return FAIL.zajęte;
      if ((world.ramp[idx] ?? 0) !== 0) return FAIL.rampa;
      if ((world.elevation[idx] ?? 0) !== baseElev) return FAIL.klif;
    }
  }

  for (const unit of world.units) {
    if (unitOverlapsFootprint(unit.pos.x, unit.pos.y, tx, ty, w, h)) return FAIL.jednostka;
  }

  const unit = unitById(world, unitId);
  if (!unit) return FAIL['poza zasięgiem'];
  const range = BUILD.rangeTiles;
  if (distSqToFootprint(unit.pos.x, unit.pos.y, tx, ty, w, h) > range * range) {
    return FAIL['poza zasięgiem'];
  }
  return OK;
}

/**
 * Komendy `build`. Sukces: zdejmuje drewno, dodaje budynek z `buildTicksLeft = buildTicks`
 * i pełnym HP (kontrakt v1: budynek w budowie stoi i blokuje, ale nie działa),
 * a footprint staje się zablokowany.
 */
export function applyBuildCommands(world: World, commands: Command[]): void {
  for (const cmd of commands) {
    if (cmd.type !== 'build') continue;
    const placement = canPlaceBuilding(world, cmd.unitId, cmd.building, cmd.x, cmd.y);
    if (!placement.ok) continue;
    const kind = cmd.building as BuildingKind;
    placeBuilding(world, kind, Math.floor(cmd.x), Math.floor(cmd.y));
  }
}

/** Bezwarunkowe postawienie budynku (walidacja jest w `canPlaceBuilding`). */
function placeBuilding(world: World, kind: BuildingKind, x: number, y: number): Building {
  const cfg = KINDS[kind];
  const { w, h } = cfg.footprint;
  const building: Building = {
    id: world.nextId++,
    kind,
    x,
    y,
    w,
    h,
    hp: cfg.hp,
    maxHp: cfg.hp,
    level: BUILD.startLevel,
    buildTicksLeft: cfg.buildTicks,
  };
  world.buildings.push(building);
  world.wood -= cfg.woodCost;
  for (let cy = y; cy < y + h; cy++) {
    for (let cx = x; cx < x + w; cx++) {
      world.blocked[cy * world.width + cx] = 1;
    }
  }
  return building;
}

/** Konstrukcja postępuje sama, bez robotnika: co tick `buildTicksLeft--` do zera. */
export function tickConstruction(world: World): void {
  for (const building of world.buildings) {
    if (building.buildTicksLeft > 0) building.buildTicksLeft -= 1;
  }
}
