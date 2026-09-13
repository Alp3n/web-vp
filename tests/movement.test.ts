/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  DIAGONAL,
  DIR_VECTORS,
  TICK_RATE,
  UNIT_RADIUS,
  applyMoveCommands,
  circleBlocked,
  createEmptyWorld,
  dirFromVector,
  isBlocked,
  moveCmd,
  moveUnits,
  step,
  tileIndex,
  type Dir8,
  type Unit,
  type World,
} from '../src/sim';
import { BALANCE } from '../src/sim/balance';

const SPEED = BALANCE.worker.speedTilesPerS;
const STEP = SPEED / TICK_RATE; // 0.2 kafla na tick
const ALL_DIRS: Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7];

function testWorld(w = 24, h = 24): World {
  return createEmptyWorld(1, w, h);
}

function addUnit(world: World, x: number, y: number): Unit {
  const unit: Unit = {
    id: world.nextId++,
    kind: 'worker',
    pos: { x, y },
    vel: { x: 0, y: 0 },
    facing: 4,
    moving: false,
    hp: 100,
    maxHp: 100,
    speed: SPEED,
  };
  world.units.push(unit);
  return unit;
}

function block(world: World, x: number, y: number): void {
  world.blocked[tileIndex(world, x, y)] = 1;
}

describe('DIR_VECTORS i dirFromVector', () => {
  it('wektory są znormalizowane, przekątne 0.70710678', () => {
    for (const dir of ALL_DIRS) {
      const v = DIR_VECTORS[dir];
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
      if (dir % 2 === 1) {
        expect(Math.abs(v.x)).toBe(DIAGONAL);
        expect(Math.abs(v.y)).toBe(DIAGONAL);
      }
    }
    // N = -y, E = +x (kontrakt).
    expect(DIR_VECTORS[0]).toEqual({ x: 0, y: -1 });
    expect(DIR_VECTORS[2]).toEqual({ x: 1, y: 0 });
    expect(DIR_VECTORS[4]).toEqual({ x: 0, y: 1 });
    expect(DIR_VECTORS[6]).toEqual({ x: -1, y: 0 });
  });

  it('snapuje wektor do własnego kierunku', () => {
    for (const dir of ALL_DIRS) {
      const v = DIR_VECTORS[dir];
      expect(dirFromVector(v.x, v.y)).toBe(dir);
      expect(dirFromVector(v.x * 12, v.y * 12)).toBe(dir);
    }
  });

  it('snapuje wektory pośrednie do najbliższego kierunku', () => {
    expect(dirFromVector(0.1, -1)).toBe(0); // prawie N
    expect(dirFromVector(1, -0.2)).toBe(2); // prawie E
    expect(dirFromVector(-1, 0.9)).toBe(5); // SW
  });

  it('zwraca null dla wektora krótszego niż 0.001', () => {
    expect(dirFromVector(0, 0)).toBeNull();
    expect(dirFromVector(0.0005, 0.0005)).toBeNull();
    expect(dirFromVector(0.002, 0)).toBe(2);
  });
});

describe('applyMoveCommands', () => {
  it('ustawia vel, facing i moving dla każdego kierunku', () => {
    const world = testWorld();
    const unit = addUnit(world, 12, 12);
    for (const dir of ALL_DIRS) {
      applyMoveCommands(world, [moveCmd(unit.id, dir)]);
      expect(unit.vel.x).toBeCloseTo(DIR_VECTORS[dir].x * SPEED, 10);
      expect(unit.vel.y).toBeCloseTo(DIR_VECTORS[dir].y * SPEED, 10);
      expect(unit.facing).toBe(dir);
      expect(unit.moving).toBe(true);
    }
  });

  it('dir: null zatrzymuje i nie zmienia facing', () => {
    const world = testWorld();
    const unit = addUnit(world, 12, 12);
    applyMoveCommands(world, [moveCmd(unit.id, 1)]);
    expect(unit.facing).toBe(1);
    applyMoveCommands(world, [moveCmd(unit.id, null)]);
    expect(unit.vel).toEqual({ x: 0, y: 0 });
    expect(unit.moving).toBe(false);
    expect(unit.facing).toBe(1);
    const before = { ...unit.pos };
    moveUnits(world);
    expect(unit.pos).toEqual(before);
  });

  it('ignoruje nieznane id i komendy innych typów', () => {
    const world = testWorld();
    const unit = addUnit(world, 12, 12);
    applyMoveCommands(world, [
      moveCmd(unit.id + 999, 2),
      { type: 'chop', unitId: unit.id, treeId: 1 },
      { type: 'cancel', unitId: unit.id },
    ]);
    expect(unit.vel).toEqual({ x: 0, y: 0 });
    expect(unit.moving).toBe(false);
    expect(unit.facing).toBe(4);
  });
});

describe('moveUnits — ruch w 8 kierunkach', () => {
  it.each(ALL_DIRS)('kierunek %i przesuwa o speed/TICK_RATE', (dir) => {
    const world = testWorld();
    const unit = addUnit(world, 12, 12);
    step(world, [moveCmd(unit.id, dir)]);
    const v = DIR_VECTORS[dir];
    expect(unit.pos.x).toBeCloseTo(12 + v.x * STEP, 10);
    expect(unit.pos.y).toBeCloseTo(12 + v.y * STEP, 10);
    const traveled = Math.hypot(unit.pos.x - 12, unit.pos.y - 12);
    expect(traveled).toBeCloseTo(STEP, 6);
    if (dir % 2 === 1) {
      expect(Math.abs(unit.pos.x - 12)).toBeCloseTo(DIAGONAL * STEP, 10);
      expect(Math.abs(unit.pos.y - 12)).toBeCloseTo(DIAGONAL * STEP, 10);
    }
  });

  it('po 10 tickach na wschód przebywa 10 * speed / TICK_RATE', () => {
    const world = testWorld();
    const unit = addUnit(world, 5, 5);
    for (let i = 0; i < 10; i++) step(world, [moveCmd(unit.id, 2)]);
    expect(unit.pos.x).toBeCloseTo(5 + 10 * STEP, 6);
    expect(unit.pos.y).toBe(5);
    expect(world.tick).toBe(10);
  });
});

describe('kolizje', () => {
  it('drzewo zatrzymuje jednostkę przed zablokowanym kaflem', () => {
    const world = testWorld();
    const unit = addUnit(world, 5.5, 5.5);
    block(world, 7, 5);
    for (let i = 0; i < 40; i++) step(world, [moveCmd(unit.id, 2)]);
    expect(unit.pos.y).toBe(5.5);
    // Zatrzymuje się tuż przed kaflem, nie wchodzi w niego.
    expect(unit.pos.x).toBeLessThanOrEqual(7 - UNIT_RADIUS);
    expect(unit.pos.x).toBeGreaterThan(7 - UNIT_RADIUS - STEP);
    expect(isBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
    expect(circleBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
  });

  it('jednostka nie przenika przez ścianę drzew przy długim marszu', () => {
    const world = testWorld();
    const unit = addUnit(world, 5.5, 5.5);
    for (let y = 0; y < world.height; y++) block(world, 9, y);
    for (let i = 0; i < 200; i++) {
      step(world, [moveCmd(unit.id, 2)]);
      expect(circleBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
    }
    expect(unit.pos.x).toBeLessThanOrEqual(9 - UNIT_RADIUS);
  });

  it('ślizga się wzdłuż ściany drzew (ruch po skosie)', () => {
    const world = testWorld();
    const unit = addUnit(world, 5.5, 5.5);
    for (let x = 0; x < world.width; x++) block(world, x, 7);
    for (let i = 0; i < 40; i++) step(world, [moveCmd(unit.id, 3)]); // SE
    // Oś y zablokowana, oś x nadal działa — to jest ślizganie.
    expect(unit.pos.y).toBeLessThanOrEqual(7 - UNIT_RADIUS);
    expect(unit.pos.y).toBeGreaterThan(7 - UNIT_RADIUS - STEP);
    expect(unit.pos.x).toBeGreaterThan(5.5 + 20 * DIAGONAL * STEP);
    expect(circleBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
  });

  it('ślizga się wzdłuż pionowej ściany', () => {
    const world = testWorld();
    const unit = addUnit(world, 5.5, 5.5);
    for (let y = 0; y < world.height; y++) block(world, 7, y);
    for (let i = 0; i < 40; i++) step(world, [moveCmd(unit.id, 3)]); // SE
    expect(unit.pos.x).toBeLessThanOrEqual(7 - UNIT_RADIUS);
    expect(unit.pos.y).toBeGreaterThan(5.5 + 20 * DIAGONAL * STEP);
  });

  it('circleBlocked wykrywa kafel dotykany promieniem jednostki', () => {
    const world = testWorld();
    block(world, 7, 5);
    // Styczność liczona jest na floatach, więc testujemy tuż obok punktu stycznego.
    expect(circleBlocked(world, 7 - UNIT_RADIUS - 1e-6, 5.5)).toBe(false);
    expect(circleBlocked(world, 7 - UNIT_RADIUS + 0.01, 5.5)).toBe(true);
    expect(circleBlocked(world, 7.5, 5.5)).toBe(true);
  });
});

describe('granice mapy', () => {
  it('clampuje pozycję do [UNIT_RADIUS, width - UNIT_RADIUS]', () => {
    const world = testWorld(16, 16);
    const unit = addUnit(world, 3, 3);
    for (let i = 0; i < 200; i++) step(world, [moveCmd(unit.id, 7)]); // NW
    expect(unit.pos.x).toBeCloseTo(UNIT_RADIUS, 10);
    expect(unit.pos.y).toBeCloseTo(UNIT_RADIUS, 10);

    for (let i = 0; i < 400; i++) step(world, [moveCmd(unit.id, 3)]); // SE
    expect(unit.pos.x).toBeCloseTo(world.width - UNIT_RADIUS, 10);
    expect(unit.pos.y).toBeCloseTo(world.height - UNIT_RADIUS, 10);
  });

  it('poza mapą jest zablokowane, więc jednostka nie wychodzi za krawędź', () => {
    const world = testWorld(12, 12);
    const unit = addUnit(world, 1, 6);
    for (let i = 0; i < 50; i++) step(world, [moveCmd(unit.id, 6)]); // W
    expect(unit.pos.x).toBeGreaterThanOrEqual(UNIT_RADIUS);
    expect(circleBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
  });
});

describe('step', () => {
  it('zwiększa tick i nie rusza jednostek bez komend', () => {
    const world = testWorld();
    const unit = addUnit(world, 4, 4);
    step(world, []);
    expect(world.tick).toBe(1);
    expect(unit.pos).toEqual({ x: 4, y: 4 });
    expect(unit.moving).toBe(false);
  });

  it('vel utrzymuje ruch przez kolejne ticki bez powtarzania komendy', () => {
    const world = testWorld();
    const unit = addUnit(world, 4, 4);
    step(world, [moveCmd(unit.id, 2)]);
    step(world, []);
    expect(unit.pos.x).toBeCloseTo(4 + 2 * STEP, 10);
  });
});
