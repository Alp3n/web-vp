/**
 * Rejestr sprite'ów Fazy 1 (kontrakt: docs/architecture.md, sekcja „assets — pipeline").
 *
 * Klucz = nazwa bazowa klatki. Sprite jednoklatkowy trafia do atlasu pod samym kluczem,
 * wieloklatkowy pod `klucz_0`, `klucz_1`, … (patrz `frameNames()` w `sprite.ts`).
 */
import {
  tile_grass0,
  tile_grass1,
  tile_grass2,
  tile_grass_hi0,
  tile_grass_hi1,
  tile_grass_hi2,
  tile_dirt,
  tile_water,
} from './tiles.ts';
import { tree_full, tree_chopped, tree_stump, shadow, dot } from './nature.ts';
import {
  worker_idle_ne,
  worker_idle_se,
  worker_idle_sw,
  worker_idle_nw,
  worker_walk_ne,
  worker_walk_se,
  worker_walk_sw,
  worker_walk_nw,
  worker_chop_ne,
  worker_chop_se,
  worker_chop_sw,
  worker_chop_nw,
} from './worker.ts';
import { fx_chip, fx_hit } from './fx.ts';
import {
  cliff_s,
  cliff_e,
  ledge_n,
  ledge_w,
  ramp_n,
  ramp_e,
  ramp_s,
  ramp_w,
  rock_small,
  rock_big,
} from './terrain.ts';
import { sawmill, generator, tower_1 } from './buildings.ts';
import { wall_build, WALL_FRAMES } from './walls.ts';
import { frameNames, type SpriteDef } from './sprite.ts';

export const SPRITES: Record<string, SpriteDef> = {
  tile_grass0,
  tile_grass1,
  tile_grass2,
  tile_grass_hi0,
  tile_grass_hi1,
  tile_grass_hi2,
  tile_dirt,
  tile_water,
  tree_full,
  tree_chopped,
  tree_stump,
  worker_idle_ne,
  worker_idle_se,
  worker_idle_sw,
  worker_idle_nw,
  worker_walk_ne,
  worker_walk_se,
  worker_walk_sw,
  worker_walk_nw,
  worker_chop_ne,
  worker_chop_se,
  worker_chop_sw,
  worker_chop_nw,
  cliff_s,
  cliff_e,
  ledge_n,
  ledge_w,
  ramp_n,
  ramp_e,
  ramp_s,
  ramp_w,
  rock_small,
  rock_big,
  ...Object.fromEntries(WALL_FRAMES.map((def, mask) => [`wall_${mask}`, def])),
  wall_build,
  sawmill,
  generator,
  tower_1,
  fx_chip,
  fx_hit,
  shadow,
  dot,
};

/** Wszystkie nazwy klatek atlasu, w kolejności rejestru. */
export function allFrameNames(): string[] {
  return Object.entries(SPRITES).flatMap(([key, def]) => frameNames(key, def));
}

export { PALETTE, PALETTE_HEX } from './palette.ts';
export { sprite, flipX, frameNames, frameToRGBA, ANCHOR_FOOT, ANCHOR_TILE } from './sprite.ts';
export { ELEV_PX } from './terrain.ts';
export { ANCHOR_WALL } from './walls.ts';
export type { SpriteDef, Anchor } from './sprite.ts';
