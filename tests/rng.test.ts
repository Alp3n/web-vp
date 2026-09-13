/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { mulberry32, rngInt, rngNext, rngPick, rngRange } from '../src/sim/rng';

describe('mulberry32', () => {
  it('jest deterministyczny dla tego samego seeda', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('różne seedy dają różne sekwencje', () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('zwraca wartości z zakresu [0, 1)', () => {
    const rand = mulberry32(777);
    for (let i = 0; i < 10000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('działa dla seeda 0 i dużych seedów', () => {
    for (const seed of [0, 1, -1, 2 ** 31 - 1, 987654321]) {
      const rand = mulberry32(seed);
      for (let i = 0; i < 50; i++) {
        const v = rand();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});

describe('rngNext', () => {
  it('daje tę samą sekwencję co mulberry32 z tym samym seedem (kontrakt)', () => {
    const seed = 424242;
    const rand = mulberry32(seed);
    const state = { state: seed };
    for (let i = 0; i < 500; i++) {
      expect(rngNext(state)).toBe(rand());
    }
  });

  it('mutuje stan przekazanego obiektu', () => {
    const state = { state: 99 };
    rngNext(state);
    expect(state.state).not.toBe(99);
    expect(Number.isInteger(state.state)).toBe(true);
  });

  it('stan jest wystarczający do wznowienia sekwencji', () => {
    const a = { state: 5 };
    for (let i = 0; i < 37; i++) rngNext(a);
    const resumed = { state: a.state };
    const expected = Array.from({ length: 10 }, () => rngNext(a));
    const actual = Array.from({ length: 10 }, () => rngNext(resumed));
    expect(actual).toEqual(expected);
  });
});

describe('rozkład', () => {
  it('średnia jest zgrubnie 0.5 i kubełki są w miarę równe', () => {
    const rand = mulberry32(2024);
    const buckets = new Array<number>(10).fill(0);
    const n = 100000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = rand();
      sum += v;
      buckets[Math.floor(v * 10)]! += 1;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 10 * 0.9);
      expect(count).toBeLessThan(n / 10 * 1.1);
    }
  });
});

describe('helpery', () => {
  it('rngRange mieści się w [min, max)', () => {
    const state = { state: 8 };
    for (let i = 0; i < 1000; i++) {
      const v = rngRange(state, -3, 7);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(7);
    }
  });

  it('rngInt mieści się w [min, max] i trafia w oba końce', () => {
    const state = { state: 9 };
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rngInt(state, 0, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('rngPick zwraca undefined dla pustej tablicy', () => {
    expect(rngPick({ state: 1 }, [])).toBeUndefined();
    expect(rngPick({ state: 1 }, ['a'])).toBe('a');
  });
});
