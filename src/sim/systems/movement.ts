/**
 * Ruch jednostek (kontrakt: `docs/architecture.md`).
 * `pos += DIR_VECTORS[dir] * speed / TICK_RATE`, kolizja okrąg (UNIT_RADIUS) vs
 * zablokowane kafle, ślizganie po osiach (najpierw x, potem y), clamp do mapy.
 */

import { TICK_RATE, UNIT_RADIUS } from '../balance';
import type { Command } from '../commands';
import type { World } from '../types';
import { DIR_VECTORS, isBlocked, unitById } from '../types';

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
 * Komendy `move` -> `vel`, `facing`, `moving`.
 * `dir: null` zatrzymuje jednostkę i NIE zmienia kierunku patrzenia.
 */
export function applyMoveCommands(world: World, commands: Command[]): void {
  for (const cmd of commands) {
    if (cmd.type !== 'move') continue;
    const unit = unitById(world, cmd.unitId);
    if (!unit) continue;
    if (cmd.dir === null || unit.speed <= 0) {
      unit.vel.x = 0;
      unit.vel.y = 0;
      unit.moving = false;
      continue;
    }
    const dir = DIR_VECTORS[cmd.dir];
    unit.vel.x = dir.x * unit.speed;
    unit.vel.y = dir.y * unit.speed;
    unit.moving = true;
    // Facing zmienia się tylko przy niezerowym ruchu.
    unit.facing = cmd.dir;
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
      if (!circleBlocked(world, nx, unit.pos.y)) unit.pos.x = nx;
    }
    if (dy !== 0) {
      const ny = clamp(unit.pos.y + dy, minY, maxY);
      if (!circleBlocked(world, unit.pos.x, ny)) unit.pos.y = ny;
    }
  }
}
