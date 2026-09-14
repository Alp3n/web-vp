/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  RAMP_E,
  buildCmd,
  buildingAt,
  canPlaceBuilding,
  createEmptyWorld,
  footprintOf,
  isBlocked,
  step,
  wallMask,
  type Unit,
  type World,
} from '../src/sim';
import { BALANCE } from '../src/sim/balance';

const WALL = BALANCE.buildings.wall;
const SAWMILL = BALANCE.buildings.sawmill;
const RANGE = BALANCE.build.rangeTiles;

function testWorld(wood = 1000): World {
  const world = createEmptyWorld(1, 20, 20);
  world.wood = wood;
  return world;
}

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

/** Robotnik w (5.5, 5.5); kafel (5, 7) leży w zasięgu budowy. */
function scene(wood = 1000): { world: World; unit: Unit } {
  const world = testWorld(wood);
  return { world, unit: addUnit(world, 5.5, 5.5) };
}

function setElevation(world: World, x: number, y: number, level: number): void {
  world.elevation[y * world.width + x] = level;
}

describe('footprintOf', () => {
  it('zgadza się z balansem', () => {
    expect(footprintOf('wall')).toEqual({ w: 1, h: 1 });
    expect(footprintOf('sawmill')).toEqual({ w: 2, h: 2 });
    expect(footprintOf('tower')).toEqual({ w: 1, h: 1 });
    expect(footprintOf('generator')).toEqual({ w: 2, h: 2 });
  });
});

describe('canPlaceBuilding — powody odrzucenia', () => {
  it('„niedostępne w tej fazie" dla wieży, generatora i nieznanego rodzaju', () => {
    const { world, unit } = scene();
    expect(canPlaceBuilding(world, unit.id, 'tower', 5, 7).reason).toBe('niedostępne w tej fazie');
    expect(canPlaceBuilding(world, unit.id, 'generator', 5, 7).reason).toBe(
      'niedostępne w tej fazie',
    );
    expect(canPlaceBuilding(world, unit.id, 'zamek', 5, 7).reason).toBe('niedostępne w tej fazie');
  });

  it('„brak drewna", gdy zasób nie pokrywa kosztu', () => {
    const { world, unit } = scene(WALL.woodCost - 1);
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 7).reason).toBe('brak drewna');
    world.wood = WALL.woodCost;
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 7).ok).toBe(true);
  });

  it('„poza mapą" dla footprintu wychodzącego poza siatkę', () => {
    const { world, unit } = scene();
    const far = addUnit(world, 0.5, 0.5);
    expect(canPlaceBuilding(world, far.id, 'wall', -1, 0).reason).toBe('poza mapą');
    expect(canPlaceBuilding(world, unit.id, 'wall', world.width, 5).reason).toBe('poza mapą');
    // Tartak 2×2 nie mieści się w ostatniej kolumnie.
    const corner = addUnit(world, world.width - 1.5, world.height - 1.5);
    expect(canPlaceBuilding(world, corner.id, 'sawmill', world.width - 1, 5).reason).toBe(
      'poza mapą',
    );
  });

  it('„zajęte" dla kafla zablokowanego (drzewo/skała/woda) i dla istniejącego budynku', () => {
    const { world, unit } = scene();
    world.blocked[7 * world.width + 5] = 1;
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 7).reason).toBe('zajęte');
    world.blocked[7 * world.width + 5] = 0;

    step(world, [buildCmd(unit.id, 'wall', 5, 7)]);
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 7).reason).toBe('zajęte');
  });

  it('„rampa" dla kafla z rampą', () => {
    const { world, unit } = scene();
    world.ramp[7 * world.width + 5] = RAMP_E;
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 7).reason).toBe('rampa');
  });

  it('„klif" dla footprintu o mieszanej elewacji', () => {
    const { world, unit } = scene();
    setElevation(world, 6, 7, 1);
    expect(canPlaceBuilding(world, unit.id, 'sawmill', 5, 7).reason).toBe('klif');
  });

  it('„jednostka", gdy footprint zachodzi na okrąg jednostki', () => {
    const { world, unit } = scene();
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 5).reason).toBe('jednostka');
    // Sąsiedni kafel jest już wolny: środek (5.5, 5.5) i promień 0.3 nie sięgają kafla (5, 6).
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 6).ok).toBe(true);
  });

  it('„poza zasięgiem" ponad BALANCE.build.rangeTiles i dla nieznanej jednostki', () => {
    const { world, unit } = scene();
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 5 + RANGE + 1).reason).toBe('poza zasięgiem');
    expect(canPlaceBuilding(world, unit.id, 'wall', 5, 5 + RANGE).ok).toBe(true);
    expect(canPlaceBuilding(world, 999, 'wall', 5, 7).reason).toBe('poza zasięgiem');
  });
});

describe('canPlaceBuilding — tartak 2×2 a wywyższenia', () => {
  it('cały na płaskowyżu: OK', () => {
    const { world, unit } = scene();
    for (const [x, y] of [
      [5, 7],
      [6, 7],
      [5, 8],
      [6, 8],
    ] as const) {
      setElevation(world, x, y, 1);
    }
    expect(canPlaceBuilding(world, unit.id, 'sawmill', 5, 7).ok).toBe(true);
  });

  it('z kaflem rampy: „rampa"', () => {
    const { world, unit } = scene();
    world.ramp[8 * world.width + 6] = RAMP_E;
    expect(canPlaceBuilding(world, unit.id, 'sawmill', 5, 7).reason).toBe('rampa');
  });

  it('na krawędzi klifu (mieszana elewacja): „klif"', () => {
    const { world, unit } = scene();
    setElevation(world, 5, 7, 1);
    setElevation(world, 6, 7, 1);
    expect(canPlaceBuilding(world, unit.id, 'sawmill', 5, 7).reason).toBe('klif');
  });
});

describe('komenda build', () => {
  it('sukces: zdejmuje drewno, dodaje budynek, blokuje footprint', () => {
    const { world, unit } = scene(SAWMILL.woodCost);
    step(world, [buildCmd(unit.id, 'sawmill', 5, 7)]);

    expect(world.wood).toBe(0);
    expect(world.buildings).toHaveLength(1);
    const b = world.buildings[0]!;
    expect(b.kind).toBe('sawmill');
    expect(b.x).toBe(5);
    expect(b.y).toBe(7);
    expect(b.w).toBe(2);
    expect(b.h).toBe(2);
    expect(b.hp).toBe(SAWMILL.hp);
    expect(b.maxHp).toBe(SAWMILL.hp);
    expect(b.level).toBe(BALANCE.build.startLevel);
    for (const [x, y] of [
      [5, 7],
      [6, 7],
      [5, 8],
      [6, 8],
    ] as const) {
      expect(isBlocked(world, x, y)).toBe(true);
      expect(buildingAt(world, x, y)?.id).toBe(b.id);
    }
    expect(buildingAt(world, 7, 7)).toBeUndefined();
  });

  it('odrzucona komenda nie zmienia świata', () => {
    const { world, unit } = scene(WALL.woodCost - 1);
    step(world, [buildCmd(unit.id, 'wall', 5, 7)]);
    expect(world.buildings).toHaveLength(0);
    expect(world.wood).toBe(WALL.woodCost - 1);
    expect(isBlocked(world, 5, 7)).toBe(false);
  });

  it('budowa kończy się po buildTicks i nie schodzi poniżej zera', () => {
    const { world, unit } = scene();
    step(world, [buildCmd(unit.id, 'wall', 5, 7)]);
    const wall = world.buildings[0]!;
    // `tickConstruction` działa już w ticku, w którym budynek powstał.
    expect(wall.buildTicksLeft).toBe(WALL.buildTicks - 1);
    for (let i = 0; i < WALL.buildTicks - 1; i++) step(world, []);
    expect(wall.buildTicksLeft).toBe(0);
    step(world, []);
    expect(wall.buildTicksLeft).toBe(0);
  });

  it('ciąg murów (drag-to-build) stawia tyle segmentów, na ile starcza drewna', () => {
    const { world, unit } = scene(WALL.woodCost * 3);
    step(world, [
      buildCmd(unit.id, 'wall', 5, 7),
      buildCmd(unit.id, 'wall', 6, 7),
      buildCmd(unit.id, 'wall', 7, 7),
      buildCmd(unit.id, 'wall', 8, 7),
    ]);
    expect(world.buildings).toHaveLength(3);
    expect(world.wood).toBe(0);
    expect(isBlocked(world, 8, 7)).toBe(false);
  });
});

describe('wallMask', () => {
  it('krzyż z 5 murów daje 15 na środku i pojedyncze bity na ramionach', () => {
    const { world, unit } = scene();
    const cx = 5;
    const cy = 8;
    step(world, [
      buildCmd(unit.id, 'wall', cx, cy),
      buildCmd(unit.id, 'wall', cx, cy - 1),
      buildCmd(unit.id, 'wall', cx + 1, cy),
      buildCmd(unit.id, 'wall', cx, cy + 1),
      buildCmd(unit.id, 'wall', cx - 1, cy),
    ]);
    expect(world.buildings).toHaveLength(5);
    expect(wallMask(world, cx, cy)).toBe(15);
    expect(wallMask(world, cx, cy - 1)).toBe(4); // sąsiad tylko od S
    expect(wallMask(world, cx + 1, cy)).toBe(8); // tylko od W
    expect(wallMask(world, cx, cy + 1)).toBe(1); // tylko od N
    expect(wallMask(world, cx - 1, cy)).toBe(2); // tylko od E
    expect(wallMask(world, 12, 12)).toBe(0);
  });

  it('tartak nie liczy się jako mur', () => {
    const { world, unit } = scene();
    step(world, [buildCmd(unit.id, 'wall', 5, 7), buildCmd(unit.id, 'sawmill', 6, 7)]);
    expect(world.buildings).toHaveLength(2);
    expect(wallMask(world, 5, 7)).toBe(0);
  });
});
