/**
 * Komendy — jedyny sposób na zmianę świata (kontrakt: `docs/architecture.md`).
 * Gracz i AI produkują dokładnie te same struktury, dzięki czemu multiplayer
 * nie będzie wymagał przepisywania symulacji.
 */

import type { Dir8, EntityId } from './types';

/** `dir: null` = stop. */
export interface MoveCommand {
  type: 'move';
  unitId: EntityId;
  dir: Dir8 | null;
}

/** Faza 2 — w Fazie 1 no-op. */
export interface ChopCommand {
  type: 'chop';
  unitId: EntityId;
  treeId: EntityId;
}

/** Faza 2 — w Fazie 1 no-op. */
export interface BuildCommand {
  type: 'build';
  unitId: EntityId;
  building: string;
  x: number;
  y: number;
}

export interface CancelCommand {
  type: 'cancel';
  unitId: EntityId;
}

export type Command = MoveCommand | ChopCommand | BuildCommand | CancelCommand;

export type CommandType = Command['type'];

// ——— Konstruktory ———

export function moveCmd(unitId: EntityId, dir: Dir8 | null): MoveCommand {
  return { type: 'move', unitId, dir };
}

export function chopCmd(unitId: EntityId, treeId: EntityId): ChopCommand {
  return { type: 'chop', unitId, treeId };
}

export function buildCmd(unitId: EntityId, building: string, x: number, y: number): BuildCommand {
  return { type: 'build', unitId, building, x, y };
}

export function cancelCmd(unitId: EntityId): CancelCommand {
  return { type: 'cancel', unitId };
}

// ——— Type guardy ———

export function isMoveCmd(cmd: Command): cmd is MoveCommand {
  return cmd.type === 'move';
}

export function isChopCmd(cmd: Command): cmd is ChopCommand {
  return cmd.type === 'chop';
}

export function isBuildCmd(cmd: Command): cmd is BuildCommand {
  return cmd.type === 'build';
}

export function isCancelCmd(cmd: Command): cmd is CancelCommand {
  return cmd.type === 'cancel';
}
