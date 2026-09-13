/**
 * Publiczne API symulacji. Render/input/AI importują wyłącznie stąd.
 * `src/sim` nie zna Phasera, DOM ani assetów (kontrakt: `docs/architecture.md`).
 */

export type { Dir8, EntityId, TileKind, Tree, Unit, Vec2, World } from './types';
export {
  DIAGONAL,
  DIR_E,
  DIR_N,
  DIR_NE,
  DIR_NW,
  DIR_S,
  DIR_SE,
  DIR_SW,
  DIR_VECTORS,
  DIR_W,
  TILE_DIRT,
  TILE_GRASS0,
  TILE_GRASS1,
  TILE_GRASS2,
  TILE_WATER,
  dirFromVector,
  isBlocked,
  tileIndex,
  treeAt,
  unitById,
} from './types';

export type {
  BuildCommand,
  CancelCommand,
  ChopCommand,
  Command,
  CommandType,
  MoveCommand,
} from './commands';
export {
  buildCmd,
  cancelCmd,
  chopCmd,
  isBuildCmd,
  isCancelCmd,
  isChopCmd,
  isMoveCmd,
  moveCmd,
} from './commands';

export { cloneWorld, createEmptyWorld, generateWorld, hashWorld } from './world';
export { step } from './tick';
export { applyMoveCommands, circleBlocked, moveUnits } from './systems/movement';

export { BALANCE, MAP_H, MAP_W, TICK_MS, TICK_RATE, TILE_H, TILE_W, UNIT_RADIUS } from './balance';
export type { RngState } from './rng';
export { mulberry32, rngInt, rngNext, rngPick, rngRange } from './rng';
