import { describe, expect, it } from 'vitest';
import type { World } from '../../src/sim';
import {
  ELEV_PX,
  RAMP_E,
  RAMP_N,
  RAMP_S,
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

  it('płaska mapa nie ma rąbków ani jaśniejszych kafli', () => {
    for (const d of collect(createEmptyWorld(1, 4, 3))) {
      expect(d.frame).toBe('tile_grass0');
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
    expect(draws.map((d) => d.frame)).toEqual(['cliff_s', 'cliff_e', 'tile_grass_hi0']);
    expect(draws[0]!.dy).toBe(0);
    expect(draws[1]!.dy).toBe(0);
    expect(draws[2]!.dy).toBe(-ELEV_PX);
  });

  it('kafel na poziomie 1 dostaje jaśniejszy wariant wierzchu', () => {
    const world = plateauWorld();
    world.tiles[3 * 6 + 3] = 1;
    expect(collect(world, [3, 3]).map((d) => d.frame)).toEqual(['tile_grass_hi1']);
  });

  it('krawędzie N i W nie dostają ścian, tylko rąbki malowane PO wierzchu', () => {
    const world = plateauWorld();
    const draws = collect(world, [2, 2]);
    expect(draws.map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_n', 'ledge_w']);
    for (const d of draws) expect(d.dy).toBe(-ELEV_PX);
  });

  it('rąbek tylko od tej strony, z której sąsiad jest niżej', () => {
    const world = plateauWorld();
    // (3,2): niżej jest tylko N; (2,3): tylko W; (3,3): środek płaskowyżu
    expect(collect(world, [3, 2]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_n']);
    expect(collect(world, [2, 3]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_w']);
    expect(collect(world, [3, 3]).map((d) => d.frame)).toEqual(['tile_grass_hi0']);
  });

  it('kafel na poziomie 0 nie ma ani ścian, ani rąbków', () => {
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
    expect(collect(world, [3, 2]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_w']);
    expect(collect(world, [3, 3]).map((d) => d.frame)).toEqual(['cliff_e', 'tile_grass_hi0', 'ledge_w']);
  });

  it('sąsiad, na który prowadzi rampa N, nie rysuje cliff_s', () => {
    const world = createEmptyWorld(1, 6, 6);
    for (let x = 0; x < 6; x++) world.elevation[3 * 6 + x] = 1;
    world.ramp[4 * 6 + 2] = RAMP_N; // podnóże (2,4), pod górę na północ -> na (2,3)
    expect(collect(world, [2, 3]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_n']);
    expect(collect(world, [1, 3]).map((d) => d.frame)).toEqual(['cliff_s', 'tile_grass_hi0', 'ledge_n']);
  });
});

describe('paintTile — rąbki a rampy', () => {
  it('kafel, na który prowadzi rampa od N (pod górę na S), nie dostaje ledge_n', () => {
    const world = plateauWorld();
    world.ramp[1 * 6 + 2] = RAMP_S; // podnóże (2,1), pod górę na południe -> na (2,2)
    expect(collect(world, [2, 2]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_w']);
  });

  it('kafel, na który prowadzi rampa od W (pod górę na E), nie dostaje ledge_w', () => {
    const world = plateauWorld();
    world.ramp[2 * 6 + 1] = RAMP_E; // podnóże (1,2), pod górę na wschód -> na (2,2)
    expect(collect(world, [2, 2]).map((d) => d.frame)).toEqual(['tile_grass_hi0', 'ledge_n']);
  });

  it('rampa nie dostaje własnych rąbków', () => {
    const world = plateauWorld();
    world.ramp[2 * 6 + 1] = RAMP_E;
    expect(collect(world, [1, 2]).map((d) => d.frame)).toEqual(['ramp_e']);
  });
});

describe('paintTerrain — świat z generatora (seed 42)', () => {
  const world = generateWorld(42);
  const draws = collect(world);

  it('każdy kafel ma dokładnie jedną klatkę wierzchu albo rampy', () => {
    const tops = new Map<string, number>();
    for (const d of draws) {
      if (d.frame.startsWith('cliff_') || d.frame.startsWith('ledge_')) continue;
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

  it('rąbek pojawia się wyłącznie na krawędzi N/W poziomu 1, nigdy przy rampie', () => {
    let ledges = 0;
    for (const d of draws) {
      if (!d.frame.startsWith('ledge_')) continue;
      ledges += 1;
      const elev = elevationOf(world, d.tx, d.ty);
      expect([d.tx, d.ty, elev]).toEqual([d.tx, d.ty, 1]);
      expect([d.tx, d.ty, rampOf(world, d.tx, d.ty)]).toEqual([d.tx, d.ty, 0]);
      const nx = d.frame === 'ledge_w' ? d.tx - 1 : d.tx;
      const ny = d.frame === 'ledge_n' ? d.ty - 1 : d.ty;
      expect(elevationOf(world, nx, ny)).toBeLessThan(elev);
      // rampa prowadząca NA ten kafel zastępuje rąbek (wjazd musi zostać otwarty)
      const leadsHere = d.frame === 'ledge_n' ? RAMP_S : RAMP_E;
      expect([nx, ny, rampOf(world, nx, ny) === leadsHere]).toEqual([nx, ny, false]);
      expect(d.dy).toBe(-ELEV_PX);
    }
    expect(ledges).toBeGreaterThan(0);
  });

  it('rąbek jest malowany PO wierzchu swojego kafla', () => {
    const order = new Map<string, number>();
    draws.forEach((d, i) => {
      if (d.frame.startsWith('tile_')) order.set(`${d.tx},${d.ty}`, i);
    });
    draws.forEach((d, i) => {
      if (!d.frame.startsWith('ledge_')) return;
      expect(order.get(`${d.tx},${d.ty}`)!).toBeLessThan(i);
    });
  });

  it('każdy kafel poziomu 1 (bez rampy) ma jaśniejszy wierzch', () => {
    for (const d of draws) {
      if (!d.frame.startsWith('tile_grass')) continue;
      const hi = d.frame.startsWith('tile_grass_hi');
      expect([d.tx, d.ty, hi]).toEqual([d.tx, d.ty, elevationOf(world, d.tx, d.ty) > 0]);
    }
  });
});
