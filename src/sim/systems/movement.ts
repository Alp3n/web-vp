/**
 * Ruch jednostek (kontrakt: `docs/architecture.md`).
 * `pos += DIR_VECTORS[dir] * speed / TICK_RATE`, kolizja okrąg (UNIT_RADIUS) vs
 * zablokowane kafle i klify (`canCross`), ślizganie po osiach (najpierw x, potem y),
 * clamp do mapy.
 */

import { TICK_RATE, UNIT_RADIUS } from '../balance';
import type { Command } from '../commands';
import type { Dir8, Unit, World } from '../types';
import { DIR_VECTORS, isBlocked, unitById } from '../types';
import { canCross } from './terrain';

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Czy okrąg o środku (x, y) i promieniu `radius` zahacza o zablokowany kafel.
 * Poza mapą kafel liczy się jako zablokowany (`isBlocked`).
 */
export function circleBlocked(world: World, x: number, y: number, radius = UNIT_RADIUS): boolean {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);
  const r2 = radius * radius;
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!isBlocked(world, tx, ty)) continue;
      const nearestX = clamp(x, tx, tx + 1);
      const nearestY = clamp(y, ty, ty + 1);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < r2) return true;
    }
  }
  return false;
}

/**
 * Czy jednostka może stać w (x, y), przychodząc z kafla (fromX, fromY).
 * Kontrakt „Wywyższenia": kafel pod środkiem musi być osiągalny z poprzedniego
 * (`canCross`), a okrąg jednostki nie może zachodzić na kafel `X ≠ T'`, dla którego
 * `canCross(T', X)` jest fałszywe (to obejmuje `blocked` i teren poza mapą).
 * Najwyżej 4 sprawdzenia na oś — zapytanie idzie po kaflach pod okręgiem (r < 0.5).
 */
export function canStandAt(
  world: World,
  fromX: number,
  fromY: number,
  x: number,
  y: number,
  radius = UNIT_RADIUS,
): boolean {
  const fx = Math.floor(fromX);
  const fy = Math.floor(fromY);
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (fx === tx && fy === ty) {
    if (isBlocked(world, tx, ty)) return false;
  } else if (!canCross(world, fx, fy, tx, ty)) {
    return false;
  }
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);
  const r2 = radius * radius;
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (cx === tx && cy === ty) continue;
      const nearestX = clamp(x, cx, cx + 1);
      const nearestY = clamp(y, cy, cy + 1);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy >= r2) continue;
      if (!canCross(world, tx, ty, cx, cy)) return false;
    }
  }
  return true;
}

/**
 * Zamiar ruchu jednostki: `vel`, `moving` i `facing` z kierunku.
 * `dir: null` (albo zerowa prędkość) zatrzymuje jednostkę i NIE zmienia kierunku patrzenia.
 * Wydzielone, bo tego samego potrzebuje `chopping.ts`, gdy komenda `move` przerywa akcję.
 */
export function setMoveIntent(unit: Unit, dir: Dir8 | null): void {
  if (dir === null || unit.speed <= 0) {
    unit.vel.x = 0;
    unit.vel.y = 0;
    unit.moving = false;
    return;
  }
  const v = DIR_VECTORS[dir];
  unit.vel.x = v.x * unit.speed;
  unit.vel.y = v.y * unit.speed;
  unit.moving = true;
  // Facing zmienia się tylko przy niezerowym ruchu.
  unit.facing = dir;
}

/** Komendy `move` -> `vel`, `facing`, `moving`. */
export function applyMoveCommands(world: World, commands: Command[]): void {
  for (const cmd of commands) {
    if (cmd.type !== 'move') continue;
    const unit = unitById(world, cmd.unitId);
    if (!unit) continue;
    setMoveIntent(unit, cmd.dir);
  }
}

/** Przesuwa jednostki o `vel / TICK_RATE` z kolizją i ślizganiem po osiach. */
export function moveUnits(world: World): void {
  const minX = UNIT_RADIUS;
  const maxX = world.width - UNIT_RADIUS;
  const minY = UNIT_RADIUS;
  const maxY = world.height - UNIT_RADIUS;
  for (const unit of world.units) {
    const dx = unit.vel.x / TICK_RATE;
    const dy = unit.vel.y / TICK_RATE;
    if (dx === 0 && dy === 0) continue;
    if (dx !== 0) {
      const nx = clamp(unit.pos.x + dx, minX, maxX);
      if (canStandAt(world, unit.pos.x, unit.pos.y, nx, unit.pos.y)) unit.pos.x = nx;
    }
    if (dy !== 0) {
      const ny = clamp(unit.pos.y + dy, minY, maxY);
      if (canStandAt(world, unit.pos.x, unit.pos.y, unit.pos.x, ny)) unit.pos.y = ny;
    }
  }
}
