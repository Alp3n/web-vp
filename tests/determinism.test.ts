/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  cloneWorld,
  generateWorld,
  hashWorld,
  moveCmd,
  step,
  type Dir8,
  type World,
} from '../src/sim';
import { mulberry32 } from '../src/sim/rng';

/**
 * DoD Fazy 1: 1000 ticków, ten sam seed i te same komendy => identyczny hash.
 * Skrypt komend ma własny RNG (mulberry32(123)), niezależny od `world.rng`,
 * żeby test sprawdzał symulację, a nie generator świata.
 */

const SCRIPT_SEED = 123;
/** Szansa, że jednostka na chwilę staje zamiast iść. */
const STOP_CHANCE = 0.15;
const MIN_HOLD = 7;
const HOLD_SPREAD = 9; // 7..15 ticków na jeden kierunek

function runScript(world: World, ticks: number, scriptSeed = SCRIPT_SEED): World {
  const rand = mulberry32(scriptSeed);
  const unit = world.units[0];
  if (!unit) throw new Error('świat bez jednostek');
  let dir: Dir8 | null = 0;
  let nextChange = 0;
  for (let t = 0; t < ticks; t++) {
    if (t >= nextChange) {
      dir = rand() < STOP_CHANCE ? null : (Math.floor(rand() * 8) as Dir8);
      nextChange = t + MIN_HOLD + Math.floor(rand() * HOLD_SPREAD);
    }
    step(world, [moveCmd(unit.id, dir)]);
  }
  return world;
}

describe('determinizm symulacji', () => {
  it('dwa przebiegi z tym samym seedem dają identyczny hash po 1000 tickach', () => {
    const a = runScript(generateWorld(42), 1000);
    const b = runScript(generateWorld(42), 1000);
    expect(a.tick).toBe(1000);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('inny seed daje inny hash', () => {
    const a = runScript(generateWorld(42), 1000);
    const b = runScript(generateWorld(43), 1000);
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });

  it('hash rozjeżdża się po jednej różnej komendzie', () => {
    const a = generateWorld(7);
    const b = generateWorld(7);
    const idA = a.units[0]!.id;
    const idB = b.units[0]!.id;
    for (let t = 0; t < 20; t++) {
      step(a, [moveCmd(idA, 2)]);
      step(b, [moveCmd(idB, t === 10 ? 6 : 2)]);
    }
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });

  it('cloneWorld daje niezależną kopię o tym samym hashu', () => {
    const original = runScript(generateWorld(2026), 200);
    const copy = cloneWorld(original);
    expect(hashWorld(copy)).toBe(hashWorld(original));

    // Kopia jest głęboka: mutacja oryginału nie dotyka klonu.
    original.units[0]!.pos.x += 1;
    original.trees[0]!.wood -= 1;
    original.tiles[0] = 3;
    expect(hashWorld(copy)).not.toBe(hashWorld(original));
  });

  it('klon i oryginał symulowane tym samym skryptem dają identyczne hashe', () => {
    const original = runScript(generateWorld(2026), 500);
    const copy = cloneWorld(original);
    runScript(original, 500, 999);
    runScript(copy, 500, 999);
    expect(hashWorld(copy)).toBe(hashWorld(original));
    expect(copy.tick).toBe(1000);
  });

  it('hash jest stabilny między wywołaniami (brak stanu ukrytego)', () => {
    const world = generateWorld(5);
    expect(hashWorld(world)).toBe(hashWorld(world));
  });

  it('hash generateWorld(42) zgadza się ze snapshotem', () => {
    // Snapshot generatora mapy. Zmiana = świadoma zmiana generatora:
    // zaktualizuj wartość i opisz zmianę w docs/decisions.md.
    // Aktualizacja: wywyższenia (płaskowyże, rampy, głazy) — docs/decisions.md.
    expect(hashWorld(generateWorld(42))).toBe('788ea845');
  });

  it('hash po 1000 tickach skryptu zgadza się ze snapshotem', () => {
    expect(hashWorld(runScript(generateWorld(42), 1000))).toBe('0b025216');
  });

  it('hash ma 8 znaków hex', () => {
    for (const seed of [0, 1, 42, 2026, -7]) {
      expect(hashWorld(generateWorld(seed))).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('step zwraca ten sam obiekt świata', () => {
    const world = generateWorld(11);
    expect(step(world, [])).toBe(world);
    expect(world.tick).toBe(1);
  });
});
