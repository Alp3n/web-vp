import { describe, expect, it } from 'vitest';
import type { Dir8 } from '../../src/sim';
import { DIR_E, DIR_N, DIR_NE, DIR_NW, DIR_S, DIR_SE, DIR_SW, DIR_W } from '../../src/sim';
import { animKey, facingFor } from '../../src/render/facing';

describe('facingFor', () => {
  it('przekątne siatki trafiają w swoje narysowane klatki', () => {
    expect(facingFor(DIR_NE).frameDir).toBe('ne');
    expect(facingFor(DIR_SE).frameDir).toBe('se');
    expect(facingFor(DIR_SW).frameDir).toBe('sw');
    expect(facingFor(DIR_NW).frameDir).toBe('nw');
  });

  it('kierunki osiowe zaokrągla zgodnie z ruchem wskazówek zegara (dir + 1)', () => {
    expect(facingFor(DIR_N).frameDir).toBe('ne');
    expect(facingFor(DIR_E).frameDir).toBe('se');
    expect(facingFor(DIR_S).frameDir).toBe('sw');
    expect(facingFor(DIR_W).frameDir).toBe('nw');
  });

  it('w Fazie 1 nigdy nie odbija sprite’a — wszystkie 4 kierunki są w atlasie', () => {
    for (let dir = 0; dir < 8; dir++) {
      expect(facingFor(dir as Dir8).flipX).toBe(false);
    }
  });

  it('każdy Dir8 daje jedną z czterech narysowanych klatek', () => {
    const drawn = new Set(['ne', 'se', 'sw', 'nw']);
    for (let dir = 0; dir < 8; dir++) {
      expect(drawn.has(facingFor(dir as Dir8).frameDir)).toBe(true);
    }
  });
});

describe('animKey', () => {
  it('składa klucz animacji zgodny z nazwami klatek atlasu', () => {
    expect(animKey('worker', true, DIR_SE)).toBe('worker_walk_se');
    expect(animKey('worker', false, DIR_NW)).toBe('worker_idle_nw');
    expect(animKey('worker', true, DIR_E)).toBe('worker_walk_se');
  });
});
