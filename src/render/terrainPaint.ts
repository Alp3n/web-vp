/**
 * Malowanie terenu z elewacją: co i w jakiej kolejności trafia do `RenderTexture`
 * (kontrakt: `docs/architecture.md`, sekcja „Wywyższenia (elewacja)" → „Render").
 *
 * Wzorzec: `terrainScene()` z `scripts/preview-sprites.ts`. Moduł jest czysty —
 * bez Phasera i DOM — więc kolejność i wybór klatek da się przetestować w node.
 */

import type { RampDir, TileKind, World } from '../sim';
import { ELEV_PX, RAMP_N, RAMP_NONE, RAMP_W, elevationOf, rampOf } from '../sim';

/** `TileKind` -> nazwa klatki w atlasie. */
export const FALLBACK_TILE_FRAME = 'tile_grass0';
export const TILE_FRAMES: readonly string[] = [
  'tile_grass0',
  'tile_grass1',
  'tile_grass2',
  'tile_dirt',
  'tile_water',
];

/** `RampDir` (1..4 = N/E/S/W pod górę) -> nazwa klatki; indeks 0 nieużywany. */
export const RAMP_FRAMES: readonly string[] = ['', 'ramp_n', 'ramp_e', 'ramp_s', 'ramp_w'];

/**
 * Zapas nad górną krawędzią bounding boxa mapy: wierzch poziomu 1 idzie o `ELEV_PX`
 * w górę, a sprite rampy sięga o kolejne `ELEV_PX` ponad wierzch swojego kafla.
 */
export const TERRAIN_TOP_MARGIN = ELEV_PX * 2;

/**
 * Rysuje klatkę atlasu na kaflu `(tx, ty)` z przesunięciem pionowym `dy` px.
 * Pozycja wynika z `pivot` klatki, który siada na środku kafla.
 */
export type PutFrame = (frame: string, tx: number, ty: number, dy: number) => void;

/** Przesunięcie pionowe (px) dla `levels` poziomów w górę; `0` zamiast `-0`. */
function up(levels: number): number {
  return levels === 0 ? 0 : -levels * ELEV_PX;
}

/**
 * Czy w stronę sąsiada `(nx, ny)` widać ścianę klifu: sąsiad jest niżej i nie jest
 * rampą prowadzącą na ten kafel (jej kierunek pod górę `up` celuje w nas).
 */
function cliffVisible(world: World, nx: number, ny: number, elev: number, up: RampDir): boolean {
  const neighbour = elevationOf(world, nx, ny);
  if (neighbour >= elev) return false;
  return !(rampOf(world, nx, ny) === up && neighbour + 1 === elev);
}

/**
 * Jeden kafel: rampa zastępuje wierzch i nie ma własnych ścian (są w jej sprite'cie),
 * zwykły kafel dostaje najpierw ściany klifu S/E, potem wierzch podniesiony o poziom.
 * Ściany N/W nie istnieją — zasłaniają je kafle rysowane później.
 */
export function paintTile(world: World, put: PutFrame, tx: number, ty: number): void {
  const elev = elevationOf(world, tx, ty);
  const ramp = rampOf(world, tx, ty);
  if (ramp !== RAMP_NONE) {
    put(RAMP_FRAMES[ramp] ?? FALLBACK_TILE_FRAME, tx, ty, up(elev));
    return;
  }
  const wallDy = up(elev - 1);
  if (cliffVisible(world, tx, ty + 1, elev, RAMP_N)) put('cliff_s', tx, ty, wallDy);
  if (cliffVisible(world, tx + 1, ty, elev, RAMP_W)) put('cliff_e', tx, ty, wallDy);
  const kind = (world.tiles[ty * world.width + tx] ?? 0) as TileKind;
  put(TILE_FRAMES[kind] ?? FALLBACK_TILE_FRAME, tx, ty, up(elev));
}

/** Cała mapa w kolejności malarza: rosnące `gx + gy`, w rzędzie rosnące `gx`. */
export function paintTerrain(world: World, put: PutFrame): void {
  const { width, height } = world;
  for (let sum = 0; sum <= width + height - 2; sum++) {
    const first = Math.max(0, sum - height + 1);
    const last = Math.min(width - 1, sum);
    for (let tx = first; tx <= last; tx++) {
      paintTile(world, put, tx, sum - tx);
    }
  }
}
