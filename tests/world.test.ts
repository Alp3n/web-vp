/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  MAP_H,
  MAP_W,
  TILE_WATER,
  createEmptyWorld,
  generateWorld,
  hashWorld,
  isBlocked,
  tileIndex,
  treeAt,
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
    expect(world.units).toEqual([]);
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

  it.each(SEEDS)('seed %i: blocked = woda albo drzewo', (seed) => {
    const world = generateWorld(seed);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const idx = tileIndex(world, x, y);
        const isWater = world.tiles[idx] === TILE_WATER;
        const hasTree = treeAt(world, x, y) !== undefined;
        expect(world.blocked[idx] === 1).toBe(isWater || hasTree);
        // Drzewo nigdy nie rośnie w wodzie.
        expect(isWater && hasTree).toBe(false);
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
