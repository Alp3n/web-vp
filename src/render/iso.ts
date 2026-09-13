/**
 * Projekcja izometryczna (kontrakt: `docs/architecture.md`, sekcja „Przestrzeń iso").
 * Tylko render/input — `src/sim` operuje wyłącznie na kaflach (float) w przestrzeni siatki.
 *
 *   screenX = (gx - gy) * TILE_W / 2
 *   screenY = (gx + gy) * TILE_H / 2
 *
 * Punkt siatki (gx, gy) to *róg* kafla; środek kafla (x, y) to (x + 0.5, y + 0.5).
 * Sąsiednie kafle są przesunięte o (TILE_W/2, TILE_H/2) = (16, 8) px.
 */

import { MAP_H, MAP_W, TILE_H, TILE_W } from '../sim';

export interface Point {
  x: number;
  y: number;
}

/** Połowa kafla — podstawa całej projekcji. */
export const HALF_TILE_W = TILE_W / 2;
export const HALF_TILE_H = TILE_H / 2;

/** Siatka (kafle, float) -> ekran (px, przestrzeń świata kamery). */
export function gridToScreen(gx: number, gy: number): Point {
  return { x: (gx - gy) * HALF_TILE_W, y: (gx + gy) * HALF_TILE_H };
}

/** Ekran (px) -> siatka (kafle, float). Odwrotność `gridToScreen`. */
export function screenToGrid(sx: number, sy: number): Point {
  const a = sx / HALF_TILE_W;
  const b = sy / HALF_TILE_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/**
 * Głębia 2.5D: im niżej na ekranie, tym wyżej w kolejności rysowania.
 * Równa ekranowemu Y punktu (kontrakt: `depth = isoY + offset`).
 */
export function depthFor(gx: number, gy: number): number {
  return (gx + gy) * HALF_TILE_H;
}

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Prostokąt opisany na całej mapie w px (do `RenderTexture` i `camera.setBounds`).
 * Skrajnie lewy róg to kafel (0, height) -> x ujemne, więc `x` jest przesunięciem
 * początku układu tekstury terenu względem (0, 0) w przestrzeni świata.
 */
export function mapBounds(width: number = MAP_W, height: number = MAP_H): MapBounds {
  return {
    x: -height * HALF_TILE_W,
    y: 0,
    width: (width + height) * HALF_TILE_W,
    height: (width + height) * HALF_TILE_H,
  };
}
