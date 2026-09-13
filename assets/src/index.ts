/**
 * Rejestr sprite'ów Fazy 1 (kontrakt: docs/architecture.md, sekcja „assets — pipeline").
 *
 * Klucz = nazwa bazowa klatki. Sprite jednoklatkowy trafia do atlasu pod samym kluczem,
 * wieloklatkowy pod `klucz_0`, `klucz_1`, … (patrz `frameNames()` w `sprite.ts`).
 */
import { tile_grass0, tile_grass1, tile_grass2, tile_dirt, tile_water } from './tiles.ts';
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
} from './worker.ts';
import { frameNames, type SpriteDef } from './sprite.ts';

export const SPRITES: Record<string, SpriteDef> = {
  tile_grass0,
  tile_grass1,
  tile_grass2,
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
  shadow,
  dot,
};

/** Wszystkie nazwy klatek atlasu, w kolejności rejestru. */
export function allFrameNames(): string[] {
  return Object.entries(SPRITES).flatMap(([key, def]) => frameNames(key, def));
}

export { PALETTE, PALETTE_HEX } from './palette.ts';
export { sprite, flipX, frameNames, frameToRGBA, ANCHOR_FOOT, ANCHOR_TILE } from './sprite.ts';
export type { SpriteDef, Anchor } from './sprite.ts';
