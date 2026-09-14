/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  MAP_H,
  MAP_W,
  TILE_WATER,
  canCross,
  createEmptyWorld,
  generateWorld,
  hashWorld,
  isBlocked,
  rampDirVector,
  rockAt,
  tileIndex,
  treeAt,
  type RampDir,
  type World,
} from '../src/sim';

const SEEDS = [1, 42, 2026];

function worker(world: World) {
  const unit = world.units.find((u) => u.kind === 'worker');
  if (!unit) throw new Error('brak robotnika');
  return unit;
}

describe('createEmptyWorld', () => {
  it('daje pusty, spójny świat', () => {
    const world = createEmptyWorld(3, 16, 8);
    expect(world.width).toBe(16);
    expect(world.height).toBe(8);
    expect(world.tiles.length).toBe(16 * 8);
    expect(world.blocked.length).toBe(16 * 8);
    expect(world.trees).toEqual([]);
    expect(world.rocks).toEqual([]);
    expect(world.units).toEqual([]);
    expect(world.elevation.length).toBe(16 * 8);
    expect(world.ramp.length).toBe(16 * 8);
    expect([...world.elevation].every((e) => e === 0)).toBe(true);
    expect([...world.ramp].every((r) => r === 0)).toBe(true);
    expect(world.tick).toBe(0);
    expect(world.nextId).toBe(1);
    expect(world.rng.state).toBe(3);
    expect(world.wood).toBe(BALANCE.economy.startingWood);
    expect(world.gold).toBe(BALANCE.economy.startingGold);
  });
});

describe('generateWorld', () => {
  it('ma rozmiar z kontraktu', () => {
    const world = generateWorld(1);
    expect(world.width).toBe(MAP_W);
    expect(world.height).toBe(MAP_H);
    expect(world.tiles.length).toBe(MAP_W * MAP_H);
    expect(world.blocked.length).toBe(MAP_W * MAP_H);
    expect(world.tick).toBe(0);
  });

  it('jest deterministyczny dla tego samego seeda', () => {
    for (const seed of SEEDS) {
      expect(hashWorld(generateWorld(seed))).toBe(hashWorld(generateWorld(seed)));
    }
  });

  it.each(SEEDS)('seed %i: używa tylko kafli 0..4', (seed) => {
    const world = generateWorld(seed);
    for (let i = 0; i < world.tiles.length; i++) {
      expect(world.tiles[i]).toBeGreaterThanOrEqual(0);
      expect(world.tiles[i]).toBeLessThanOrEqual(4);
    }
  });

  it.each(SEEDS)('seed %i: liczba drzew mieści się w 500–700', (seed) => {
    const world = generateWorld(seed);
    expect(world.trees.length).toBeGreaterThanOrEqual(500);
    expect(world.trees.length).toBeLessThanOrEqual(700);
  });

  it.each(SEEDS)('seed %i: drzewa mają pełne drewno i stan full', (seed) => {
    const world = generateWorld(seed);
    const ids = new Set<number>();
    for (const tree of world.trees) {
      expect(tree.wood).toBe(BALANCE.trees.woodPerTree);
      expect(tree.state).toBe('full');
      expect(Number.isInteger(tree.x)).toBe(true);
      expect(Number.isInteger(tree.y)).toBe(true);
      expect(ids.has(tree.id)).toBe(false);
      ids.add(tree.id);
      expect(tree.id).toBeLessThan(world.nextId);
    }
  });

  it.each(SEEDS)('seed %i: krawędź mapy to woda i blokuje', (seed) => {
    const world = generateWorld(seed);
    for (let x = 0; x < world.width; x++) {
      for (const y of [0, world.height - 1]) {
        expect(world.tiles[tileIndex(world, x, y)]).toBe(TILE_WATER);
        expect(isBlocked(world, x, y)).toBe(true);
      }
    }
    for (let y = 0; y < world.height; y++) {
      for (const x of [0, world.width - 1]) {
        expect(world.tiles[tileIndex(world, x, y)]).toBe(TILE_WATER);
        expect(isBlocked(world, x, y)).toBe(true);
      }
    }
  });

  it.each(SEEDS)('seed %i: woda trzyma się obrzeża (środek mapy jest suchy)', (seed) => {
    const world = generateWorld(seed);
    const margin = 12;
    for (let y = margin; y < world.height - margin; y++) {
      for (let x = margin; x < world.width - margin; x++) {
        expect(world.tiles[tileIndex(world, x, y)]).not.toBe(TILE_WATER);
      }
    }
  });

  it.each(SEEDS)('seed %i: blocked = woda albo drzewo albo głaz', (seed) => {
    const world = generateWorld(seed);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const idx = tileIndex(world, x, y);
        const isWater = world.tiles[idx] === TILE_WATER;
        const hasTree = treeAt(world, x, y) !== undefined;
        const hasRock = rockAt(world, x, y) !== undefined;
        expect(world.blocked[idx] === 1).toBe(isWater || hasTree || hasRock);
        // Drzewo ani głaz nigdy nie stoi w wodzie, i nigdy nie stoją na tym samym kaflu.
        expect(isWater && (hasTree || hasRock)).toBe(false);
        expect(hasTree && hasRock).toBe(false);
      }
    }
  });

  it.each(SEEDS)('seed %i: jest robotnik na wolnym kaflu', (seed) => {
    const world = generateWorld(seed);
    const unit = worker(world);
    expect(world.units.length).toBe(1);
    expect(unit.kind).toBe('worker');
    expect(unit.hp).toBe(BALANCE.worker.hp);
    expect(unit.maxHp).toBe(BALANCE.worker.maxHp);
    expect(unit.speed).toBe(BALANCE.worker.speedTilesPerS);
    expect(unit.moving).toBe(false);
    expect(unit.vel).toEqual({ x: 0, y: 0 });
    expect(isBlocked(world, unit.pos.x, unit.pos.y)).toBe(false);
    expect(treeAt(world, unit.pos.x, unit.pos.y)).toBeUndefined();
  });

  it.each(SEEDS)('seed %i: start w okolicy środka mapy', (seed) => {
    const world = generateWorld(seed);
    const unit = worker(world);
    const offset = BALANCE.mapgen.clearings.startOffsetMax + 2;
    expect(Math.abs(unit.pos.x - world.width / 2)).toBeLessThanOrEqual(offset);
    expect(Math.abs(unit.pos.y - world.height / 2)).toBeLessThanOrEqual(offset);
  });

  it.each(SEEDS)('seed %i: brak drzew w promieniu 4 od startu', (seed) => {
    const world = generateWorld(seed);
    const unit = worker(world);
    for (const tree of world.trees) {
      const dx = tree.x + 0.5 - unit.pos.x;
      const dy = tree.y + 0.5 - unit.pos.y;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(4);
    }
  });

  it.each(SEEDS)('seed %i: warianty trawy to mniej więcej 60/25/15 %', (seed) => {
    const world = generateWorld(seed);
    const counts = [0, 0, 0];
    for (let i = 0; i < world.tiles.length; i++) {
      const kind = world.tiles[i] ?? 0;
      if (kind <= 2) counts[kind]! += 1;
    }
    const total = counts[0]! + counts[1]! + counts[2]!;
    expect(counts[0]! / total).toBeGreaterThan(0.5);
    expect(counts[0]! / total).toBeLessThan(0.7);
    expect(counts[1]! / total).toBeGreaterThan(0.18);
    expect(counts[1]! / total).toBeLessThan(0.33);
    expect(counts[2]! / total).toBeGreaterThan(0.08);
    expect(counts[2]! / total).toBeLessThan(0.22);
  });

  it.each(SEEDS)('seed %i: ma polany — duże obszary bez drzew poza startem', (seed) => {
    const world = generateWorld(seed);
    const unit = worker(world);
    let clearings = 0;
    // Szukamy środków kół o promieniu 4 zupełnie wolnych od drzew, z dala od startu.
    for (let y = 8; y < world.height - 8; y += 2) {
      for (let x = 8; x < world.width - 8; x += 2) {
        if (Math.hypot(x - unit.pos.x, y - unit.pos.y) < 12) continue;
        let free = true;
        for (const tree of world.trees) {
          if (Math.hypot(tree.x + 0.5 - x, tree.y + 0.5 - y) <= 4) {
            free = false;
            break;
          }
        }
        if (free) clearings += 1;
      }
    }
    expect(clearings).toBeGreaterThan(0);
  });

  it('różne seedy dają różne mapy', () => {
    const hashes = new Set(SEEDS.map((seed) => hashWorld(generateWorld(seed))));
    expect(hashes.size).toBe(SEEDS.length);
  });
});

describe('helpery kafli', () => {
  it('tileIndex zwraca -1 poza mapą', () => {
    const world = createEmptyWorld(1, 8, 8);
    expect(tileIndex(world, 0, 0)).toBe(0);
    expect(tileIndex(world, 7.9, 7.9)).toBe(63);
    expect(tileIndex(world, -0.1, 0)).toBe(-1);
    expect(tileIndex(world, 8, 0)).toBe(-1);
    expect(tileIndex(world, 0, 8)).toBe(-1);
  });

  it('isBlocked traktuje teren poza mapą jako zablokowany', () => {
    const world = createEmptyWorld(1, 8, 8);
    expect(isBlocked(world, 4, 4)).toBe(false);
    expect(isBlocked(world, -1, 4)).toBe(true);
    expect(isBlocked(world, 8, 4)).toBe(true);
    world.blocked[tileIndex(world, 4, 4)] = 1;
    expect(isBlocked(world, 4.9, 4.1)).toBe(true);
  });

  it('treeAt znajduje drzewo po kaflu', () => {
    const world = generateWorld(42);
    const tree = world.trees[0]!;
    expect(treeAt(world, tree.x, tree.y)).toBe(tree);
    expect(treeAt(world, tree.x + 0.9, tree.y + 0.9)).toBe(tree);
    const unit = worker(world);
    expect(treeAt(world, unit.pos.x, unit.pos.y)).toBeUndefined();
  });
});

// ——— Wywyższenia: płaskowyże, rampy, głazy (kontrakt: docs/architecture.md) ———

const PLATEAUS = BALANCE.mapgen.plateaus;
const ROCKS = BALANCE.mapgen.rocks;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function idxOf(world: World, x: number, y: number): number {
  return y * world.width + x;
}

function tileXY(world: World, idx: number): { x: number; y: number } {
  const x = idx % world.width;
  return { x, y: (idx - x) / world.width };
}

/** Spójne (4-sąsiedztwo) grupy kafli poziomu 1 = pojedyncze płaskowyże. */
function plateauComponents(world: World): number[][] {
  const seen = new Uint8Array(world.width * world.height);
  const out: number[][] = [];
  for (let i = 0; i < world.elevation.length; i++) {
    if (world.elevation[i] !== 1 || seen[i] === 1) continue;
    const comp: number[] = [];
    const queue = [i];
    seen[i] = 1;
    for (let head = 0; head < queue.length; head++) {
      const idx = queue[head]!;
      comp.push(idx);
      const { x, y } = tileXY(world, idx);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
        const n = idxOf(world, nx, ny);
        if (world.elevation[n] === 1 && seen[n] === 0) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Kafle osiągalne ze startu regułą `canCross` (4-sąsiedztwo). */
function reachableFromStart(world: World): Uint8Array {
  const unit = worker(world);
  const sx = Math.floor(unit.pos.x);
  const sy = Math.floor(unit.pos.y);
  const seen = new Uint8Array(world.width * world.height);
  const first = idxOf(world, sx, sy);
  seen[first] = 1;
  const queue = [first];
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = tileXY(world, queue[head]!);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      const n = idxOf(world, nx, ny);
      if (seen[n] === 1) continue;
      if (!canCross(world, x, y, nx, ny)) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return seen;
}

/** Indeksy kafli rampy prowadzących na dany płaskowyż. */
function rampsOfPlateau(world: World, comp: readonly number[]): number[] {
  const tiles = new Set(comp);
  const out: number[] = [];
  for (let i = 0; i < world.ramp.length; i++) {
    const dir = world.ramp[i] as RampDir;
    if (!dir) continue;
    const { x, y } = tileXY(world, i);
    const v = rampDirVector(dir);
    if (tiles.has(idxOf(world, x + v.x, y + v.y))) out.push(i);
  }
  return out;
}

describe('generateWorld — wywyższenia', () => {
  it.each(SEEDS)('seed %i: elevation to 0/1, ramp to 0..4', (seed) => {
    const world = generateWorld(seed);
    expect(world.elevation.length).toBe(MAP_W * MAP_H);
    expect(world.ramp.length).toBe(MAP_W * MAP_H);
    for (let i = 0; i < world.elevation.length; i++) {
      expect(world.elevation[i]).toBeLessThan(BALANCE.sim.elevLevels);
      expect(world.ramp[i]).toBeLessThanOrEqual(4);
      // Kafel rampy jest zawsze podstawą (poziom dolny).
      if (world.ramp[i] !== 0) expect(world.elevation[i]).toBe(0);
    }
  });

  it.each(SEEDS)('seed %i: jest 2–4 płaskowyżów', (seed) => {
    const world = generateWorld(seed);
    const comps = plateauComponents(world);
    expect(comps.length).toBeGreaterThanOrEqual(PLATEAUS.countMin);
    expect(comps.length).toBeLessThanOrEqual(PLATEAUS.countMax);
    for (const comp of comps) expect(comp.length).toBeGreaterThan(10);
  });

  it.each(SEEDS)('seed %i: każdy płaskowyż ma co najmniej jedną rampę szerokości 2', (seed) => {
    const world = generateWorld(seed);
    for (const comp of plateauComponents(world)) {
      const ramps = rampsOfPlateau(world, comp);
      expect(ramps.length).toBeGreaterThanOrEqual(PLATEAUS.rampsMin * PLATEAUS.rampWidth);
      // Każdy kafel rampy ma bliźniaka o tym samym kierunku, prostopadle obok.
      for (const idx of ramps) {
        const dir = world.ramp[idx] as RampDir;
        const { x, y } = tileXY(world, idx);
        const v = rampDirVector(dir);
        const left = world.ramp[idxOf(world, x + v.y, y - v.x)];
        const right = world.ramp[idxOf(world, x - v.y, y + v.x)];
        expect(left === dir || right === dir).toBe(true);
      }
    }
  });

  it.each(SEEDS)('seed %i: rampa ma sąsiada górnego na 1 i dolnego na 0', (seed) => {
    const world = generateWorld(seed);
    for (let i = 0; i < world.ramp.length; i++) {
      const dir = world.ramp[i] as RampDir;
      if (!dir) continue;
      const { x, y } = tileXY(world, i);
      const v = rampDirVector(dir);
      const up = idxOf(world, x + v.x, y + v.y);
      const down = idxOf(world, x - v.x, y - v.y);
      expect(world.elevation[i]).toBe(0);
      expect(world.elevation[up]).toBe(1);
      expect(world.ramp[up]).toBe(0);
      expect(world.elevation[down]).toBe(0);
      expect(world.ramp[down]).toBe(0);
      // Korytarz rampy jest przejezdny (drzewa i głazy wycięte).
      expect(world.blocked[i]).toBe(0);
      expect(world.blocked[up]).toBe(0);
      expect(world.blocked[down]).toBe(0);
    }
  });

  it.each(SEEDS)('seed %i: start jest na poziomie 0 i min. 12 kafli od płaskowyżu', (seed) => {
    const world = generateWorld(seed);
    const unit = worker(world);
    expect(world.elevation[tileIndex(world, unit.pos.x, unit.pos.y)]).toBe(0);
    expect(world.ramp[tileIndex(world, unit.pos.x, unit.pos.y)]).toBe(0);
    for (let i = 0; i < world.elevation.length; i++) {
      if (world.elevation[i] !== 1) continue;
      const { x, y } = tileXY(world, i);
      const d = Math.hypot(x + 0.5 - unit.pos.x, y + 0.5 - unit.pos.y);
      expect(d).toBeGreaterThanOrEqual(PLATEAUS.minDistanceFromStart);
    }
  });

  it.each(SEEDS)('seed %i: płaskowyże trzymają się z dala od wody i krawędzi mapy', (seed) => {
    const world = generateWorld(seed);
    const d = PLATEAUS.minDistanceFromWater;
    for (let i = 0; i < world.elevation.length; i++) {
      if (world.elevation[i] !== 1) continue;
      const { x, y } = tileXY(world, i);
      expect(x).toBeGreaterThanOrEqual(PLATEAUS.margin);
      expect(y).toBeGreaterThanOrEqual(PLATEAUS.margin);
      expect(x).toBeLessThan(world.width - PLATEAUS.margin);
      expect(y).toBeLessThan(world.height - PLATEAUS.margin);
      for (let ny = y - d; ny <= y + d; ny++) {
        for (let nx = x - d; nx <= x + d; nx++) {
          expect(world.tiles[idxOf(world, nx, ny)]).not.toBe(TILE_WATER);
        }
      }
    }
  });

  it.each(SEEDS)('seed %i: głazy są w zakresie 20–40, na suchym lądzie i w blocked', (seed) => {
    const world = generateWorld(seed);
    expect(world.rocks.length).toBeGreaterThanOrEqual(ROCKS.countMin);
    expect(world.rocks.length).toBeLessThanOrEqual(ROCKS.countMax);
    const unit = worker(world);
    const ids = new Set<number>();
    for (const rock of world.rocks) {
      const idx = idxOf(world, rock.x, rock.y);
      expect(rock.size === 0 || rock.size === 1).toBe(true);
      expect(ids.has(rock.id)).toBe(false);
      ids.add(rock.id);
      expect(rock.id).toBeLessThan(world.nextId);
      expect(world.blocked[idx]).toBe(1);
      expect(world.tiles[idx]).not.toBe(TILE_WATER);
      expect(world.ramp[idx]).toBe(0);
      expect(world.elevation[idx]).toBeLessThan(BALANCE.sim.elevLevels);
      expect(treeAt(world, rock.x, rock.y)).toBeUndefined();
      expect(rockAt(world, rock.x, rock.y)).toBe(rock);
      const d = Math.hypot(rock.x + 0.5 - unit.pos.x, rock.y + 0.5 - unit.pos.y);
      expect(d).toBeGreaterThan(ROCKS.startSafeRadius);
    }
  });

  it.each(SEEDS)('seed %i: każdy wolny kafel płaskowyżu jest osiągalny ze startu', (seed) => {
    const world = generateWorld(seed);
    const reach = reachableFromStart(world);
    let plateauTiles = 0;
    let unreachable = 0;
    for (let i = 0; i < world.elevation.length; i++) {
      if (world.elevation[i] !== 1 || world.blocked[i] === 1) continue;
      plateauTiles += 1;
      if (reach[i] !== 1) unreachable += 1;
    }
    expect(plateauTiles).toBeGreaterThan(0);
    expect(unreachable).toBe(0);
    // Rampy też muszą być osiągalne (to jedyne wejście na górę).
    for (let i = 0; i < world.ramp.length; i++) {
      if (world.ramp[i] !== 0) expect(reach[i]).toBe(1);
    }
  });
});
