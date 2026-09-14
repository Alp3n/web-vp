/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  TICK_RATE,
  buildCmd,
  cloneWorld,
  createEmptyWorld,
  hashWorld,
  sawmillProduces,
  step,
  type Tree,
  type Unit,
  type World,
} from '../src/sim';
import { BALANCE } from '../src/sim/balance';

const SAWMILL = BALANCE.buildings.sawmill;

function addUnit(world: World, x: number, y: number): Unit {
  const unit: Unit = {
    id: world.nextId++,
    kind: 'worker',
    pos: { x, y },
    vel: { x: 0, y: 0 },
    facing: 4,
    moving: false,
    hp: BALANCE.worker.hp,
    maxHp: BALANCE.worker.maxHp,
    speed: BALANCE.worker.speedTilesPerS,
    action: null,
  };
  world.units.push(unit);
  return unit;
}

function addTree(world: World, x: number, y: number, state: Tree['state'] = 'full'): Tree {
  const tree: Tree = {
    id: world.nextId++,
    x,
    y,
    wood: BALANCE.trees.woodPerTree,
    state,
    chops: 0,
  };
  world.trees.push(tree);
  if (state !== 'stump') world.blocked[y * world.width + x] = 1;
  return tree;
}

function stepN(world: World, n: number): void {
  for (let i = 0; i < n; i++) step(world, []);
}

/**
 * Świat z tartakiem 2×2 w (5, 7), postawionym komendą i (opcjonalnie) już wybudowanym.
 * Robotnik stoi w (5.5, 5.5), czyli w zasięgu budowy.
 */
function sceneWithSawmill(opts: { tree?: boolean; finished?: boolean } = {}): World {
  const world = createEmptyWorld(1, 24, 24);
  world.wood = SAWMILL.woodCost;
  const unit = addUnit(world, 5.5, 5.5);
  if (opts.tree ?? true) addTree(world, 9, 9);
  step(world, [buildCmd(unit.id, 'sawmill', 5, 7)]);
  expect(world.buildings).toHaveLength(1);
  expect(world.wood).toBe(0);
  if (opts.finished ?? true) stepN(world, SAWMILL.buildTicks);
  return world;
}

describe('tartak', () => {
  it('bez drzew w promieniu nie daje drewna', () => {
    const world = sceneWithSawmill({ tree: false });
    expect(sawmillProduces(world, world.buildings[0]!)).toBe(false);
    const before = world.wood;
    stepN(world, TICK_RATE * 5);
    expect(world.wood).toBe(before);
    expect(world.woodFrac).toBe(0);
  });

  it('drzewo poza promieniem treeRadiusTiles się nie liczy', () => {
    const world = createEmptyWorld(1, 40, 40);
    world.wood = SAWMILL.woodCost;
    const unit = addUnit(world, 5.5, 5.5);
    // Środek footprintu (5,7)+2×2 to (6, 8); drzewo dalej niż promień.
    addTree(world, 6, 8 + SAWMILL.treeRadiusTiles + 1);
    step(world, [buildCmd(unit.id, 'sawmill', 5, 7)]);
    stepN(world, SAWMILL.buildTicks);
    expect(sawmillProduces(world, world.buildings[0]!)).toBe(false);
    stepN(world, TICK_RATE * 3);
    expect(world.wood).toBe(0);
  });

  it('z drzewem w promieniu daje woodPerSecond drewna na sekundę', () => {
    const world = sceneWithSawmill();
    expect(sawmillProduces(world, world.buildings[0]!)).toBe(true);
    const before = world.wood;
    stepN(world, TICK_RATE);
    expect(world.wood).toBe(before + SAWMILL.woodPerSecond);
    stepN(world, TICK_RATE * 4);
    expect(world.wood).toBe(before + SAWMILL.woodPerSecond * 5);
  });

  it('nie produkuje w trakcie budowy', () => {
    const world = sceneWithSawmill({ finished: false });
    expect(world.buildings[0]!.buildTicksLeft).toBeGreaterThan(0);
    stepN(world, SAWMILL.buildTicks - 2);
    expect(world.wood).toBe(0);
    expect(world.woodFrac).toBe(0);
    // Dopiero po zakończeniu budowy wpada pierwsza porcja.
    stepN(world, TICK_RATE + 2);
    expect(world.wood).toBeGreaterThan(0);
  });

  it('dwa tartaki produkują podwójnie', () => {
    const world = sceneWithSawmill();
    world.wood = SAWMILL.woodCost;
    const unit = world.units[0]!;
    step(world, [buildCmd(unit.id, 'sawmill', 3, 7)]);
    stepN(world, SAWMILL.buildTicks);
    const before = world.wood;
    stepN(world, TICK_RATE);
    expect(world.wood).toBe(before + SAWMILL.woodPerSecond * 2);
  });

  it('pieniek w promieniu nie wystarcza', () => {
    const world = createEmptyWorld(1, 24, 24);
    world.wood = SAWMILL.woodCost;
    const unit = addUnit(world, 5.5, 5.5);
    const tree = addTree(world, 9, 9);
    step(world, [buildCmd(unit.id, 'sawmill', 5, 7)]);
    stepN(world, SAWMILL.buildTicks);
    tree.state = 'stump';
    expect(sawmillProduces(world, world.buildings[0]!)).toBe(false);
    const before = world.wood;
    stepN(world, TICK_RATE * 3);
    expect(world.wood).toBe(before);
  });
});

describe('woodFrac', () => {
  it('zostaje w [0, 1) — część całkowita trafia do wood', () => {
    const world = sceneWithSawmill();
    for (let i = 0; i < TICK_RATE * 10; i++) {
      step(world, []);
      expect(world.woodFrac).toBeGreaterThanOrEqual(0);
      expect(world.woodFrac).toBeLessThan(1);
    }
  });

  it('jest deterministyczny: klon i oryginał dają ten sam stan i hash', () => {
    const original = sceneWithSawmill();
    const copy = cloneWorld(original);
    expect(hashWorld(copy)).toBe(hashWorld(original));
    stepN(original, TICK_RATE * 7);
    stepN(copy, TICK_RATE * 7);
    expect(copy.wood).toBe(original.wood);
    expect(copy.woodFrac).toBe(original.woodFrac);
    expect(hashWorld(copy)).toBe(hashWorld(original));
  });

  it('dwa niezależne przebiegi tego samego scenariusza są identyczne', () => {
    const a = sceneWithSawmill();
    const b = sceneWithSawmill();
    stepN(a, TICK_RATE * 13);
    stepN(b, TICK_RATE * 13);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
});
