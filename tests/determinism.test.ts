/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  DIR_VECTORS,
  buildCmd,
  canPlaceBuilding,
  chopCmd,
  cloneWorld,
  generateWorld,
  hashWorld,
  moveCmd,
  nearestChoppableTree,
  step,
  type Command,
  type Dir8,
  type World,
} from '../src/sim';
import { BALANCE } from '../src/sim/balance';
import { mulberry32 } from '../src/sim/rng';

/**
 * DoD Fazy 1: 1000 ticków, ten sam seed i te same komendy => identyczny hash.
 * Skrypt komend ma własny RNG (mulberry32(123)), niezależny od `world.rng`,
 * żeby test sprawdzał symulację, a nie generator świata.
 * Faza 2: skrypt dokłada rąbanie (gdy drzewo jest w zasięgu) i stawianie murów
 * (gdy `canPlaceBuilding` się zgadza) — decyzje zależą wyłącznie od stanu świata,
 * więc pozostają deterministyczne.
 */

const SCRIPT_SEED = 123;
/** Szansa, że jednostka na chwilę staje zamiast iść. */
const STOP_CHANCE = 0.15;
const MIN_HOLD = 7;
const HOLD_SPREAD = 9; // 7..15 ticków na jeden kierunek
/** Co ile ticków skrypt próbuje postawić mur przed robotnikiem. */
const BUILD_EVERY = 37;
/** Ile kafli przed robotnikiem celuje „duch" muru. */
const GHOST_AHEAD = 2;
/**
 * Zapas drewna na starcie skryptu. W 1000 tickach (50 s) robotnik zdąży zarąbać
 * najwyżej kilka drzew, a mur kosztuje 50 — bez zapasu test nigdy nie dotknąłby
 * ścieżki budowania. To fixture testu, nie zmiana balansu.
 */
const SCRIPT_START_WOOD = 200;

function runScript(world: World, ticks: number, scriptSeed = SCRIPT_SEED): World {
  const rand = mulberry32(scriptSeed);
  const unit = world.units[0];
  if (!unit) throw new Error('świat bez jednostek');
  world.wood += SCRIPT_START_WOOD;
  let dir: Dir8 | null = 0;
  let nextChange = 0;
  for (let t = 0; t < ticks; t++) {
    if (t >= nextChange) {
      dir = rand() < STOP_CHANCE ? null : (Math.floor(rand() * 8) as Dir8);
      nextChange = t + MIN_HOLD + Math.floor(rand() * HOLD_SPREAD);
    }
    // W trakcie rąbania skrypt nie wysyła ruchu — inaczej sam by sobie przerwał akcję.
    const commands: Command[] = [];
    if (unit.action === null) {
      commands.push(moveCmd(unit.id, dir));
      // Rąb, gdy tylko drzewo jest w zasięgu (tak zachowuje się kontekstowy przycisk akcji).
      const tree = nearestChoppableTree(world, unit.pos, BALANCE.worker.interactRange);
      if (tree) commands.push(chopCmd(unit.id, tree.id));
      if (t % BUILD_EVERY === 0) {
        // Kafel przed robotnikiem — tak samo jak duch budynku w trybie budowy.
        const v = DIR_VECTORS[unit.facing];
        const gx = Math.floor(unit.pos.x + v.x * GHOST_AHEAD);
        const gy = Math.floor(unit.pos.y + v.y * GHOST_AHEAD);
        if (canPlaceBuilding(world, unit.id, 'wall', gx, gy).ok) {
          commands.push(buildCmd(unit.id, 'wall', gx, gy));
        }
      }
    }
    step(world, commands);
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

  it('skrypt naprawdę dotyka ścieżek Fazy 2 (rąbanie i budowanie)', () => {
    // Gdyby skrypt przestał rąbać albo budować, test determinizmu przestałby
    // pilnować tych systemów, a hash dalej by się zgadzał.
    const world = runScript(generateWorld(42), 1000);
    expect(world.trees.some((t) => t.chops > 0)).toBe(true);
    expect(world.trees.some((t) => t.state === 'stump')).toBe(true);
    expect(world.buildings.length).toBeGreaterThan(0);
    expect(world.buildings.every((b) => b.kind === 'wall')).toBe(true);
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
    // Aktualizacja Fazy 2: hash obejmuje `tree.chops`, `unit.action`, `woodFrac` i `buildings`.
    expect(hashWorld(generateWorld(42))).toBe('d1522955');
  });

  it('hash po 1000 tickach skryptu zgadza się ze snapshotem', () => {
    expect(hashWorld(runScript(generateWorld(42), 1000))).toBe('f20e6dcd');
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
