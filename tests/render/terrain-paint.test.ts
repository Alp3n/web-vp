import { describe, expect, it } from 'vitest';
import type { World } from '../../src/sim';
import {
  ELEV_PX,
  RAMP_E,
  RAMP_N,
  RAMP_W,
  createEmptyWorld,
  generateWorld,
  rampOf,
  elevationOf,
} from '../../src/sim';
import { paintTerrain, paintTile } from '../../src/render/terrainPaint';

interface Draw {
  frame: string;
  tx: number;
  ty: number;
  dy: number;
}

function collect(world: World, tile?: [number, number]): Draw[] {
  const draws: Draw[] = [];
  const put = (frame: string, tx: number, ty: number, dy: number): void => {
    draws.push({ frame, tx, ty, dy });
  };
  if (tile) paintTile(world, put, tile[0], tile[1]);
  else paintTerrain(world, put);
  return draws;
}

/** Mapa 6×6: płaskowyż 2..4 × 2..4 na poziomie 1. */
function plateauWorld(): World {
  const world = createEmptyWorld(1, 6, 6);
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) world.elevation[y * 6 + x] = 1;
  }
  return world;
}

describe('paintTerrain — kolejność', () => {
  it('maluje rosnąco po gx + gy, a w rzędzie rosnąco po gx', () => {
    const draws = collect(createEmptyWorld(1, 4, 3));
    let prevSum = -1;
    let prevX = -1;
    for (const d of draws) {
      const sum = d.tx + d.ty;
      expect(sum).toBeGreaterThanOrEqual(prevSum);
      if (sum === prevSum) expect(d.tx).toBeGreaterThan(prevX);
      prevSum = sum;
      prevX = d.tx;
    }
  });

  it('płaska mapa to dokładnie jedna klatka wierzchu na kafel', () => {
    const world = createEmptyWorld(1, 4, 3);
    const draws = collect(world);
    expect(draws).toHaveLength(12);
    for (const d of draws) {
      expect(d.frame).toBe('tile_grass0');
      expect(d.dy).toBe(0);
    }
  });
});

describe('paintTile — klify', () => {
  it('wierzch płaskowyżu idzie w górę o ELEV_PX, ściana zostaje na poziomie 0', () => {
    const world = plateauWorld();
    const draws = collect(world, [4, 4]);
    expect(draws.map((d) => d.frame)).toEqual(['cliff_s', 'cliff_e', 'tile_grass0']);
    expect(draws[0]!.dy).toBe(0);
    expect(draws[1]!.dy).toBe(0);
    expect(draws[2]!.dy).toBe(-ELEV_PX);
  });

  it('krawędzie N i W nie dostają ścian (są niewidoczne)', () => {
    const world = plateauWorld();
    expect(collect(world, [2, 2]).map((d) => d.frame)).toEqual(['tile_grass0']);
  });

  it('kafel na poziomie 0 nie ma ścian', () => {
    const world = plateauWorld();
    expect(collect(world, [1, 1]).map((d) => d.frame)).toEqual(['tile_grass0']);
  });
});

describe('paintTile — rampy', () => {
  it('rampa rysuje własną klatkę zamiast wierzchu i nie ma ścian', () => {
    const world = plateauWorld();
    world.ramp[2 * 6 + 1] = RAMP_E; // podnóże na (1,2), pod górę na wschód
    expect(collect(world, [1, 2])).toEqual([{ frame: 'ramp_e', tx: 1, ty: 2, dy: 0 }]);
  });

  it('sąsiad, na który prowadzi rampa E, nie rysuje cliff_e', () => {
    const world = createEmptyWorld(1, 6, 6);
    for (let y = 0; y < 6; y++) world.elevation[y * 6 + 3] = 1;
    world.ramp[2 * 6 + 4] = RAMP_W; // podnóże (4,2), pod górę na zachód -> na (3,2)
    expect(collect(world, [3, 2]).map((d) => d.frame)).toEqual(['tile_grass0']);
    expect(collect(world, [3, 3]).map((d) => d.frame)).toEqual(['cliff_e', 'tile_grass0']);
  });

  it('sąsiad, na który prowadzi rampa N, nie rysuje cliff_s', () => {
    const world = createEmptyWorld(1, 6, 6);
    for (let x = 0; x < 6; x++) world.elevation[3 * 6 + x] = 1;
    world.ramp[4 * 6 + 2] = RAMP_N; // podnóże (2,4), pod górę na północ -> na (2,3)
    expect(collect(world, [2, 3]).map((d) => d.frame)).toEqual(['tile_grass0']);
    expect(collect(world, [1, 3]).map((d) => d.frame)).toEqual(['cliff_s', 'tile_grass0']);
  });
});

describe('paintTerrain — świat z generatora (seed 42)', () => {
  const world = generateWorld(42);
  const draws = collect(world);

  it('każdy kafel ma dokładnie jedną klatkę wierzchu albo rampy', () => {
    const tops = new Map<string, number>();
    for (const d of draws) {
      if (d.frame.startsWith('cliff_')) continue;
      const key = `${d.tx},${d.ty}`;
      tops.set(key, (tops.get(key) ?? 0) + 1);
    }
    expect(tops.size).toBe(world.width * world.height);
    for (const count of tops.values()) expect(count).toBe(1);
  });

  it('kafle ramp dostają klatkę ramp_* zgodną z kierunkiem', () => {
    const byTile = new Map<string, Draw[]>();
    for (const d of draws) {
      const key = `${d.tx},${d.ty}`;
      byTile.set(key, [...(byTile.get(key) ?? []), d]);
    }
    let ramps = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const dir = rampOf(world, x, y);
        if (dir === 0) continue;
        ramps++;
        const tile = byTile.get(`${x},${y}`)!;
        expect(tile).toHaveLength(1);
        expect(tile[0]!.frame).toBe(['', 'ramp_n', 'ramp_e', 'ramp_s', 'ramp_w'][dir]);
        expect(tile[0]!.dy).toBe(elevationOf(world, x, y) === 0 ? 0 : -ELEV_PX);
      }
    }
    expect(ramps).toBeGreaterThan(0);
  });

  it('ściana pojawia się wyłącznie tam, gdzie sąsiad S/E jest niżej', () => {
    for (const d of draws) {
      if (!d.frame.startsWith('cliff_')) continue;
      const elev = elevationOf(world, d.tx, d.ty);
      const nx = d.frame === 'cliff_e' ? d.tx + 1 : d.tx;
      const ny = d.frame === 'cliff_s' ? d.ty + 1 : d.ty;
      expect(elevationOf(world, nx, ny)).toBeLessThan(elev);
    }
  });
});
