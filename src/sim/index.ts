/**
 * Publiczne API symulacji. Render/input/AI importują wyłącznie stąd.
 * `src/sim` nie zna Phasera, DOM ani assetów (kontrakt: `docs/architecture.md`).
 */

export type {
  Building,
  BuildingKind,
  Dir8,
  EntityId,
  RampDir,
  Rock,
  TileKind,
  Tree,
  Unit,
  UnitAction,
  Vec2,
  World,
} from './types';
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
  RAMP_E,
  RAMP_N,
  RAMP_NONE,
  RAMP_S,
  RAMP_W,
  TILE_DIRT,
  TILE_GRASS0,
  TILE_GRASS1,
  TILE_GRASS2,
  TILE_WATER,
  dirFromVector,
  isBlocked,
  rockAt,
  tileIndex,
  treeAt,
  treeById,
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
export {
  applyMoveCommands,
  canStandAt,
  circleBlocked,
  moveUnits,
  setMoveIntent,
} from './systems/movement';
export { applyActionCommands, canChop, nearestChoppableTree, tickChopping } from './systems/chopping';
export type { PlacementReason, PlacementResult } from './systems/building';
export {
  applyBuildCommands,
  buildingAt,
  canPlaceBuilding,
  footprintOf,
  isKindAvailable,
  tickConstruction,
  wallMask,
  woodCostOf,
} from './systems/building';
export { hasTreeInRadius, sawmillProduces, tickEconomy } from './systems/economy';
export {
  canCross,
  canCrossTerrain,
  elevationAt,
  elevationOf,
  oppositeRampDir,
  rampDirVector,
  rampOf,
} from './systems/terrain';

export {
  BALANCE,
  ELEV_LEVELS,
  ELEV_PX,
  MAP_H,
  MAP_W,
  TICK_MS,
  TICK_RATE,
  TILE_H,
  TILE_W,
  UNIT_RADIUS,
} from './balance';
export type { RngState } from './rng';
export { mulberry32, rngInt, rngNext, rngPick, rngRange } from './rng';
