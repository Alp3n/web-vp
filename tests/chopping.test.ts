/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  DIR_E,
  TICK_RATE,
  cancelCmd,
  canChop,
  chopCmd,
  createEmptyWorld,
  isBlocked,
  moveCmd,
  nearestChoppableTree,
  step,
  type Tree,
  type Unit,
  type World,
} from '../src/sim';
import { BALANCE } from '../src/sim/balance';

const WORKER = BALANCE.worker;
const CHOP_TICKS = WORKER.chopTicks;

function testWorld(): World {
  return createEmptyWorld(1, 16, 16);
}

function addUnit(world: World, x: number, y: number): Unit {
  const unit: Unit = {
    id: world.nextId++,
    kind: 'worker',
    pos: { x, y },
    vel: { x: 0, y: 0 },
    facing: 0,
    moving: false,
    hp: WORKER.hp,
    maxHp: WORKER.maxHp,
    speed: WORKER.speedTilesPerS,
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

/** Jednostka tuż obok drzewa: środek (5.5, 5.5), drzewo na kaflu (6, 5) — dystans 1.0. */
function sceneNextToTree(): { world: World; unit: Unit; tree: Tree } {
  const world = testWorld();
  const unit = addUnit(world, 5.5, 5.5);
  const tree = addTree(world, 6, 5);
  return { world, unit, tree };
}

function stepN(world: World, n: number): void {
  for (let i = 0; i < n; i++) step(world, []);
}

describe('rąbanie — przyjmowanie komendy', () => {
  it('odrzuca chop, gdy drzewo jest poza zasięgiem interakcji', () => {
    const world = testWorld();
    const unit = addUnit(world, 2.5, 2.5);
    const tree = addTree(world, 9, 9);
    expect(canChop(world, unit.id, tree.id)).toBe(false);
    step(world, [chopCmd(unit.id, tree.id)]);
    expect(unit.action).toBeNull();
    expect(world.wood).toBe(0);
  });

  it('przyjmuje chop w zasięgu: ustawia akcję i zatrzymuje jednostkę', () => {
    const { world, unit, tree } = sceneNextToTree();
    // Jednostka biegnie — komenda chop w tym samym ticku ma ją zatrzymać.
    step(world, [moveCmd(unit.id, DIR_E), chopCmd(unit.id, tree.id)]);
    expect(unit.action).toEqual({ type: 'chop', treeId: tree.id, ticksLeft: CHOP_TICKS - 1 });
    expect(unit.vel).toEqual({ x: 0, y: 0 });
    expect(unit.moving).toBe(false);
    expect(unit.pos.x).toBe(5.5);
  });

  it('obraca jednostkę w stronę drzewa (najbliższy Dir8)', () => {
    const { world, unit, tree } = sceneNextToTree();
    expect(unit.facing).toBe(0);
    step(world, [chopCmd(unit.id, tree.id)]);
    expect(unit.facing).toBe(DIR_E);
  });

  it('odrzuca rąbanie pieńka', () => {
    const world = testWorld();
    const unit = addUnit(world, 5.5, 5.5);
    const stump = addTree(world, 6, 5, 'stump');
    expect(canChop(world, unit.id, stump.id)).toBe(false);
    step(world, [chopCmd(unit.id, stump.id)]);
    expect(unit.action).toBeNull();
  });

  it('odrzuca chop dla nieistniejącej jednostki lub drzewa', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(999, tree.id), chopCmd(unit.id, 999)]);
    expect(unit.action).toBeNull();
  });
});

describe('rąbanie — skutki', () => {
  it('po chopTicks daje chopWood drewna i stan „chopped"', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id)]);
    stepN(world, CHOP_TICKS - 2);
    expect(world.wood).toBe(0);
    expect(unit.action).not.toBeNull();

    step(world, []); // ostatni tick akcji
    expect(world.wood).toBe(WORKER.chopWood);
    expect(tree.chops).toBe(1);
    expect(tree.state).toBe('chopped');
    expect(tree.wood).toBe(BALANCE.trees.woodPerTree - WORKER.chopWood);
    expect(unit.action).toBeNull();
    // Kafel nadal blokuje — dopiero pieniek go zwalnia.
    expect(isBlocked(world, tree.x, tree.y)).toBe(true);
  });

  it('chopsToStump rąbnięć zmienia drzewo w pieniek i odblokowuje kafel', () => {
    const { world, unit, tree } = sceneNextToTree();
    for (let i = 0; i < BALANCE.trees.chopsToStump; i++) {
      step(world, [chopCmd(unit.id, tree.id)]);
      stepN(world, CHOP_TICKS - 1);
    }
    expect(tree.chops).toBe(BALANCE.trees.chopsToStump);
    expect(tree.state).toBe('stump');
    expect(tree.wood).toBe(0);
    expect(world.wood).toBe(WORKER.chopWood * BALANCE.trees.chopsToStump);
    expect(isBlocked(world, tree.x, tree.y)).toBe(false);
  });

  it('po zamianie w pieniek jednostka może wejść na kafel', () => {
    const { world, unit, tree } = sceneNextToTree();
    // Przed rąbaniem drzewo zatrzymuje jednostkę przed kaflem (6, 5).
    for (let i = 0; i < 10; i++) step(world, [moveCmd(unit.id, DIR_E)]);
    expect(unit.pos.x).toBeLessThan(6);
    step(world, [moveCmd(unit.id, null)]);

    for (let i = 0; i < BALANCE.trees.chopsToStump; i++) {
      step(world, [chopCmd(unit.id, tree.id)]);
      stepN(world, CHOP_TICKS - 1);
    }
    for (let i = 0; i < 15; i++) step(world, [moveCmd(unit.id, DIR_E)]);
    expect(unit.pos.x).toBeGreaterThan(7);
  });

  it('dorąbanie drzewa przez kogoś innego kończy akcję bez nagrody', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id)]);
    tree.state = 'stump';
    step(world, []);
    expect(unit.action).toBeNull();
    expect(world.wood).toBe(0);
  });
});

describe('rąbanie — przerwanie akcji', () => {
  it('komenda move z kierunkiem przerywa rąbanie bez nagrody i wznawia ruch', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id)]);
    stepN(world, 10);
    expect(unit.action).not.toBeNull();

    step(world, [moveCmd(unit.id, 4)]); // S — wolny kafel
    expect(unit.action).toBeNull();
    expect(unit.moving).toBe(true);
    expect(unit.pos.y).toBeGreaterThan(5.5);

    stepN(world, CHOP_TICKS);
    expect(world.wood).toBe(0);
    expect(tree.chops).toBe(0);
    expect(tree.state).toBe('full');
  });

  it('move z dir = null (stop) NIE przerywa rąbania', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id)]);
    step(world, [moveCmd(unit.id, null)]);
    expect(unit.action).not.toBeNull();
    stepN(world, CHOP_TICKS - 2);
    expect(world.wood).toBe(WORKER.chopWood);
  });

  it('komenda cancel przerywa rąbanie bez nagrody', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id)]);
    stepN(world, 10);
    step(world, [cancelCmd(unit.id)]);
    expect(unit.action).toBeNull();
    stepN(world, CHOP_TICKS);
    expect(world.wood).toBe(0);
    expect(tree.state).toBe('full');
  });

  it('w jednym ticku wygrywa ostatnia komenda w tablicy (move po chop)', () => {
    const { world, unit, tree } = sceneNextToTree();
    step(world, [chopCmd(unit.id, tree.id), moveCmd(unit.id, 4)]);
    expect(unit.action).toBeNull();
    expect(unit.moving).toBe(true);
  });
});

describe('nearestChoppableTree', () => {
  it('znajduje najbliższe drzewo w zasięgu i pomija pieńki', () => {
    const world = testWorld();
    addUnit(world, 5.5, 5.5);
    const far = addTree(world, 7, 5);
    const near = addTree(world, 6, 5);
    const stump = addTree(world, 5, 5, 'stump');
    expect(nearestChoppableTree(world, { x: 5.5, y: 5.5 })?.id).toBe(near.id);
    expect(nearestChoppableTree(world, { x: 7.5, y: 5.5 })?.id).toBe(far.id);
    near.state = 'stump';
    expect(nearestChoppableTree(world, { x: 5.5, y: 5.5 })).toBeUndefined();
    expect(stump.state).toBe('stump');
  });

  it('zwraca undefined poza zasięgiem, ale znajduje drzewo przy większym promieniu', () => {
    const world = testWorld();
    addTree(world, 9, 9);
    expect(nearestChoppableTree(world, { x: 2.5, y: 2.5 })).toBeUndefined();
    expect(nearestChoppableTree(world, { x: 2.5, y: 2.5 }, 20)).toBeDefined();
  });
});

describe('rąbanie — determinizm', () => {
  it('ten sam skrypt rąbania daje ten sam stan', () => {
    const run = (): World => {
      const { world, unit, tree } = sceneNextToTree();
      step(world, [chopCmd(unit.id, tree.id)]);
      stepN(world, TICK_RATE * 10);
      return world;
    };
    const a = run();
    const b = run();
    expect(a.wood).toBe(b.wood);
    expect(a.trees[0]?.chops).toBe(b.trees[0]?.chops);
  });
});
