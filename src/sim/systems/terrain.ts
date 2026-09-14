/**
 * Teren pionowy: poziomy (`elevation`), rampy (`ramp`) i reguła przejścia między kaflami.
 * Kontrakt: `docs/architecture.md`, sekcja „Wywyższenia (elewacja)".
 *
 * Bez rampy przejście jest możliwe tylko w poziomie — krawędź płaskowyżu to klif (ściana).
 * Rampa działa jak korytarz: w kierunku `ramp` prowadzi o poziom wyżej, w przeciwnym
 * wraca na poziom dolny, a w bok pozwala tylko na ten sam poziom (albo na bliźniaczą
 * rampę, czyli drugi kafel rampy szerokości 2).
 */

import type { RampDir, Vec2, World } from '../types';
import { isBlocked, tileIndex } from '../types';

/** Wektor „pod górę" dla kierunku rampy; `{0,0}` dla braku rampy. */
export function rampDirVector(dir: RampDir): Vec2 {
  switch (dir) {
    case 1:
      return { x: 0, y: -1 };
    case 2:
      return { x: 1, y: 0 };
    case 3:
      return { x: 0, y: 1 };
    case 4:
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/** Kierunek przeciwny (`0` zostaje `0`). */
export function oppositeRampDir(dir: RampDir): RampDir {
  switch (dir) {
    case 1:
      return 3;
    case 2:
      return 4;
    case 3:
      return 1;
    case 4:
      return 2;
    default:
      return 0;
  }
}

/** Kierunek (jako `RampDir`) z kafla a do ortogonalnie sąsiedniego kafla b; 0 = nie sąsiaduje. */
function stepDir(dx: number, dy: number): RampDir {
  if (dx === 0 && dy === -1) return 1;
  if (dx === 1 && dy === 0) return 2;
  if (dx === 0 && dy === 1) return 3;
  if (dx === -1 && dy === 0) return 4;
  return 0;
}

/** Poziom kafla (int). Poza mapą: 0. */
export function elevationOf(world: World, tx: number, ty: number): number {
  const idx = tileIndex(world, tx, ty);
  return idx < 0 ? 0 : (world.elevation[idx] ?? 0);
}

/** Kierunek rampy na kaflu. Poza mapą: 0. */
export function rampOf(world: World, tx: number, ty: number): RampDir {
  const idx = tileIndex(world, tx, ty);
  return idx < 0 ? 0 : ((world.ramp[idx] ?? 0) as RampDir);
}

/**
 * Reguła rampy widziana z jednej strony: kafel `from` jest rampą o kierunku `rFrom`,
 * a `to` leży w kierunku `d`. Gdy `from` nie jest rampą — brak ograniczeń z tej strony.
 */
function sideOk(
  eFrom: number,
  rFrom: RampDir,
  eTo: number,
  rTo: RampDir,
  d: RampDir,
): boolean {
  if (rFrom === 0) return true;
  if (d === rFrom) return eTo === eFrom + 1;
  if (d === oppositeRampDir(rFrom)) return eTo === eFrom && rTo === 0;
  // Prostopadle: ten sam poziom, w bok tylko na zwykły kafel albo na bliźniaczą rampę.
  return eTo === eFrom && (rTo === 0 || rTo === rFrom);
}

/** Reguła terenu (poziomy + rampy) bez sprawdzania `blocked`. */
export function canCrossTerrain(
  world: World,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const tax = Math.floor(ax);
  const tay = Math.floor(ay);
  const tbx = Math.floor(bx);
  const tby = Math.floor(by);
  if (tileIndex(world, tax, tay) < 0 || tileIndex(world, tbx, tby) < 0) return false;
  const dx = tbx - tax;
  const dy = tby - tay;
  if (dx === 0 && dy === 0) return true;

  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    // Przekątna: obie ścieżki „po L" muszą być przejezdne.
    return (
      canCrossTerrain(world, tax, tay, tbx, tay) &&
      canCrossTerrain(world, tbx, tay, tbx, tby) &&
      canCrossTerrain(world, tax, tay, tax, tby) &&
      canCrossTerrain(world, tax, tby, tbx, tby)
    );
  }

  const d = stepDir(dx, dy);
  if (d === 0) return false; // nie-sąsiedzi

  const ea = elevationOf(world, tax, tay);
  const eb = elevationOf(world, tbx, tby);
  const ra = rampOf(world, tax, tay);
  const rb = rampOf(world, tbx, tby);
  if (ra === 0 && rb === 0) return ea === eb;
  return sideOk(ea, ra, eb, rb, d) && sideOk(eb, rb, ea, ra, oppositeRampDir(d));
}

/**
 * Czy da się przejść z kafla (ax, ay) na sąsiedni (bx, by): oba niezablokowane
 * i zgodne z regułą poziomów/ramp. Symetryczne. Przekątne tylko po regule L.
 */
export function canCross(world: World, ax: number, ay: number, bx: number, by: number): boolean {
  const tax = Math.floor(ax);
  const tay = Math.floor(ay);
  const tbx = Math.floor(bx);
  const tby = Math.floor(by);
  if (isBlocked(world, tax, tay) || isBlocked(world, tbx, tby)) return false;
  const dx = tbx - tax;
  const dy = tby - tay;
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    // Przekątna: rogi też muszą być wolne (obie ścieżki po L przejezdne).
    return (
      canCross(world, tax, tay, tbx, tay) &&
      canCross(world, tbx, tay, tbx, tby) &&
      canCross(world, tax, tay, tax, tby) &&
      canCross(world, tax, tby, tbx, tby)
    );
  }
  return canCrossTerrain(world, tax, tay, tbx, tby);
}

/**
 * Wysokość pod punktem (float): zwykły kafel = `elevation`, rampa = `elevation + f`,
 * gdzie `f` to postęp środka jednostki wzdłuż osi rampy w stronę góry.
 * Render: `screenY -= elevationAt(...) * ELEV_PX`.
 */
export function elevationAt(world: World, gx: number, gy: number): number {
  const idx = tileIndex(world, gx, gy);
  if (idx < 0) return 0;
  const base = world.elevation[idx] ?? 0;
  const dir = (world.ramp[idx] ?? 0) as RampDir;
  if (dir === 0) return base;
  const fx = gx - Math.floor(gx);
  const fy = gy - Math.floor(gy);
  switch (dir) {
    case 1:
      return base + (1 - fy);
    case 2:
      return base + fx;
    case 3:
      return base + fy;
    default:
      return base + (1 - fx);
  }
}
