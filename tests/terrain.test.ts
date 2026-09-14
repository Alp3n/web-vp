/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  canCross,
  createEmptyWorld,
  elevationAt,
  rampDirVector,
  tileIndex,
  type RampDir,
  type World,
} from '../src/sim';

/**
 * Reguły z kontraktu (docs/architecture.md, „Wywyższenia"):
 * bez rampy przejście tylko w poziomie, rampa prowadzi o poziom wyżej w swoim
 * kierunku, w tył na poziom dolny, w bok tylko w poziomie (albo na bliźniaczą rampę).
 */

const RAMP_N: RampDir = 1;
const RAMP_E: RampDir = 2;
const RAMP_S: RampDir = 3;
const RAMP_W: RampDir = 4;
const ALL_RAMPS: RampDir[] = [RAMP_N, RAMP_E, RAMP_S, RAMP_W];

function flatWorld(w = 10, h = 10): World {
  return createEmptyWorld(1, w, h);
}

function setElev(world: World, x: number, y: number, level: number): void {
  world.elevation[tileIndex(world, x, y)] = level;
}

function setRamp(world: World, x: number, y: number, dir: RampDir): void {
  world.ramp[tileIndex(world, x, y)] = dir;
}

function block(world: World, x: number, y: number): void {
  world.blocked[tileIndex(world, x, y)] = 1;
}

/** Kafel o poziom wyżej po stronie „pod górę" rampy. */
function upTile(x: number, y: number, dir: RampDir): { x: number; y: number } {
  const v = rampDirVector(dir);
  return { x: x + v.x, y: y + v.y };
}

/** Oba kierunki naraz — `canCross` musi być symetryczne. */
function bothWays(world: World, ax: number, ay: number, bx: number, by: number): boolean {
  const ab = canCross(world, ax, ay, bx, by);
  expect(canCross(world, bx, by, ax, ay)).toBe(ab);
  return ab;
}

describe('rampDirVector', () => {
  it('1=N, 2=E, 3=S, 4=W, 0 = brak rampy', () => {
    expect(rampDirVector(0)).toEqual({ x: 0, y: 0 });
    expect(rampDirVector(RAMP_N)).toEqual({ x: 0, y: -1 });
    expect(rampDirVector(RAMP_E)).toEqual({ x: 1, y: 0 });
    expect(rampDirVector(RAMP_S)).toEqual({ x: 0, y: 1 });
    expect(rampDirVector(RAMP_W)).toEqual({ x: -1, y: 0 });
  });
});

describe('canCross — teren płaski', () => {
  it('ten sam poziom przechodzi w obie strony', () => {
    const world = flatWorld();
    expect(bothWays(world, 4, 4, 5, 4)).toBe(true);
    expect(bothWays(world, 4, 4, 4, 5)).toBe(true);
  });

  it('zablokowany kafel (drzewo, głaz, woda) nie przechodzi', () => {
    const world = flatWorld();
    block(world, 5, 4);
    expect(bothWays(world, 4, 4, 5, 4)).toBe(false);
  });

  it('poza mapą nie przechodzi', () => {
    const world = flatWorld();
    expect(canCross(world, 0, 0, -1, 0)).toBe(false);
    expect(canCross(world, 9, 9, 10, 9)).toBe(false);
  });

  it('nie-sąsiedzi nie przechodzą', () => {
    const world = flatWorld();
    expect(canCross(world, 4, 4, 6, 4)).toBe(false);
    expect(canCross(world, 4, 4, 6, 6)).toBe(false);
  });

  it('bierze kafel spod współrzędnych float', () => {
    const world = flatWorld();
    block(world, 5, 4);
    expect(canCross(world, 4.9, 4.1, 5.2, 4.7)).toBe(false);
  });
});

describe('canCross — klif', () => {
  it('krawędź płaskowyżu bez rampy jest nieprzejezdna w obie strony', () => {
    const world = flatWorld();
    setElev(world, 5, 4, 1);
    expect(bothWays(world, 4, 4, 5, 4)).toBe(false);
    expect(bothWays(world, 5, 4, 6, 4)).toBe(false);
    expect(bothWays(world, 5, 4, 5, 3)).toBe(false);
  });

  it('po wierzchu płaskowyżu chodzi się normalnie', () => {
    const world = flatWorld();
    setElev(world, 5, 4, 1);
    setElev(world, 6, 4, 1);
    expect(bothWays(world, 5, 4, 6, 4)).toBe(true);
  });
});

describe('canCross — rampy', () => {
  it.each(ALL_RAMPS)('rampa %i prowadzi pod górę i z powrotem', (dir) => {
    const world = flatWorld();
    setRamp(world, 5, 5, dir);
    const up = upTile(5, 5, dir);
    setElev(world, up.x, up.y, 1);
    // W górę: przejezdne.
    expect(bothWays(world, 5, 5, up.x, up.y)).toBe(true);
    // W dół (przeciwnie do kierunku rampy): przejezdne na poziom 0.
    const down = upTile(5, 5, dir === 1 ? 3 : dir === 3 ? 1 : dir === 2 ? 4 : 2);
    expect(bothWays(world, 5, 5, down.x, down.y)).toBe(true);
  });

  it.each(ALL_RAMPS)('rampa %i: dwie rampy w jednej linii się nie łączą', (dir) => {
    const world = flatWorld();
    setRamp(world, 5, 5, dir);
    const up = upTile(5, 5, dir);
    setElev(world, up.x, up.y, 1);
    const back = dir === 1 ? 3 : dir === 3 ? 1 : dir === 2 ? 4 : 2;
    const down = upTile(5, 5, back as RampDir);
    setRamp(world, down.x, down.y, dir);
    expect(bothWays(world, 5, 5, down.x, down.y)).toBe(false);
  });

  it.each(ALL_RAMPS)('rampa %i: w bok tylko na ten sam poziom', (dir) => {
    const world = flatWorld();
    setRamp(world, 5, 5, dir);
    const up = upTile(5, 5, dir);
    setElev(world, up.x, up.y, 1);
    const v = rampDirVector(dir);
    const side = { x: 5 + v.y, y: 5 - v.x };
    // Zwykły kafel poziomu 0 obok rampy: przejezdny.
    expect(bothWays(world, 5, 5, side.x, side.y)).toBe(true);
    // Ten sam kafel podniesiony do poziomu 1 (ściana rampy): nieprzejezdny.
    setElev(world, side.x, side.y, 1);
    expect(bothWays(world, 5, 5, side.x, side.y)).toBe(false);
  });

  it.each(ALL_RAMPS)('rampa %i: bliźniaczy kafel rampy jest przejezdny w bok', (dir) => {
    const world = flatWorld();
    setRamp(world, 5, 5, dir);
    const up = upTile(5, 5, dir);
    setElev(world, up.x, up.y, 1);
    const v = rampDirVector(dir);
    const twin = { x: 5 + v.y, y: 5 - v.x };
    setRamp(world, twin.x, twin.y, dir);
    setElev(world, twin.x + v.x, twin.y + v.y, 1);
    expect(bothWays(world, 5, 5, twin.x, twin.y)).toBe(true);

    // Rampa o innym kierunku obok = nie jest bliźniacza.
    const other: RampDir = dir === RAMP_N ? RAMP_E : RAMP_N;
    setRamp(world, twin.x, twin.y, other);
    expect(bothWays(world, 5, 5, twin.x, twin.y)).toBe(false);
  });

  it('rampa nie prowadzi na płaskowyż, gdy sąsiad w jej kierunku jest płaski', () => {
    const world = flatWorld();
    setRamp(world, 5, 5, RAMP_N);
    // (5,4) zostaje na poziomie 0 — rampa „w powietrze" nie przechodzi.
    expect(bothWays(world, 5, 5, 5, 4)).toBe(false);
  });

  it('zablokowana rampa nie przechodzi', () => {
    const world = flatWorld();
    setRamp(world, 5, 5, RAMP_N);
    setElev(world, 5, 4, 1);
    block(world, 5, 5);
    expect(bothWays(world, 5, 5, 5, 4)).toBe(false);
  });
});

describe('canCross — przekątne po regule L', () => {
  it('na płaskim terenie przekątna jest przejezdna', () => {
    const world = flatWorld();
    expect(bothWays(world, 4, 4, 5, 5)).toBe(true);
  });

  it('jeden zablokowany róg wycina przekątną', () => {
    const world = flatWorld();
    block(world, 5, 4);
    expect(bothWays(world, 4, 4, 5, 5)).toBe(false);
  });

  it('przekątna na płaskowyż jest nieprzejezdna (obie ścieżki po L przez klif)', () => {
    const world = flatWorld();
    setElev(world, 5, 5, 1);
    expect(bothWays(world, 4, 4, 5, 5)).toBe(false);
  });

  it('przekątna po wierzchu płaskowyżu działa, gdy oba rogi są na poziomie 1', () => {
    const world = flatWorld();
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ]) {
      setElev(world, x!, y!, 1);
    }
    expect(bothWays(world, 4, 4, 5, 5)).toBe(true);
  });

  it('przekątna z rampy na płaskowyż jest nieprzejezdna', () => {
    const world = flatWorld();
    setRamp(world, 5, 5, RAMP_N);
    setElev(world, 5, 4, 1);
    setElev(world, 4, 4, 1);
    // (4,4) jest na płaskowyżu, ale nie leży w kierunku rampy — róg (4,5) to klif.
    expect(bothWays(world, 5, 5, 4, 4)).toBe(false);
  });
});

describe('canCross — symetria na losowym układzie', () => {
  it('canCross(a,b) === canCross(b,a) dla każdej pary sąsiadów', () => {
    const world = flatWorld(12, 12);
    // Płaskowyż 4×4 z rampą 2-kaflową od południa.
    for (let y = 4; y < 8; y++) {
      for (let x = 4; x < 8; x++) setElev(world, x, y, 1);
    }
    setRamp(world, 5, 8, RAMP_N);
    setRamp(world, 6, 8, RAMP_N);
    block(world, 3, 3);
    block(world, 5, 5);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, -1],
        ]) {
          const nx = x + dx!;
          const ny = y + dy!;
          expect(canCross(world, x, y, nx, ny)).toBe(canCross(world, nx, ny, x, y));
        }
      }
    }
  });
});

describe('elevationAt', () => {
  it('zwykły kafel = jego poziom', () => {
    const world = flatWorld();
    setElev(world, 5, 5, 1);
    expect(elevationAt(world, 5.5, 5.5)).toBe(1);
    expect(elevationAt(world, 4.5, 5.5)).toBe(0);
    expect(elevationAt(world, -1, 5)).toBe(0);
  });

  it.each([
    [RAMP_N, { x: 5.5, y: 5.999 }, { x: 5.5, y: 5.5 }, { x: 5.5, y: 5 }],
    [RAMP_S, { x: 5.5, y: 5 }, { x: 5.5, y: 5.5 }, { x: 5.5, y: 5.999 }],
    [RAMP_E, { x: 5, y: 5.5 }, { x: 5.5, y: 5.5 }, { x: 5.999, y: 5.5 }],
    [RAMP_W, { x: 5.999, y: 5.5 }, { x: 5.5, y: 5.5 }, { x: 5, y: 5.5 }],
  ] as const)('rampa %i: 0 na dole, 0.5 w środku, 1 na górze', (dir, bottom, middle, top) => {
    const world = flatWorld();
    setRamp(world, 5, 5, dir);
    const up = upTile(5, 5, dir);
    setElev(world, up.x, up.y, 1);
    expect(elevationAt(world, bottom.x, bottom.y)).toBeCloseTo(0, 2);
    expect(elevationAt(world, middle.x, middle.y)).toBeCloseTo(0.5, 10);
    expect(elevationAt(world, top.x, top.y)).toBeCloseTo(1, 2);
    // Wejście na górę rampy daje dokładnie poziom sąsiada.
    expect(elevationAt(world, up.x + 0.5, up.y + 0.5)).toBe(1);
  });
});
