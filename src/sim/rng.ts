/**
 * Deterministyczny RNG (mulberry32). Jedyne źródło losowości w `src/sim`.
 * Kontrakt (docs/architecture.md):
 *   mulberry32(seed) -> () => number          // własny, zamknięty stan
 *   rngNext({ state }) -> number              // krok na stanie trzymanym w World
 * Oba warianty używają tego samego algorytmu, więc n wywołań `mulberry32(s)`
 * daje dokładnie tę samą sekwencję co n wywołań `rngNext({ state: s })`.
 */

export interface RngState {
  state: number;
}

/** Jeden krok mulberry32: zwraca nowy stan i wartość z [0, 1). */
function step(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** Generator z własnym stanem. Zwraca liczby z [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const r = step(state);
    state = r.state;
    return r.value;
  };
}

/** Krok na współdzielonym stanie (mutuje `rng.state` w World). Zwraca [0, 1). */
export function rngNext(rng: RngState): number {
  const r = step(rng.state);
  rng.state = r.state;
  return r.value;
}

/** Liczba zmiennoprzecinkowa z [min, max). */
export function rngRange(rng: RngState, min: number, max: number): number {
  return min + rngNext(rng) * (max - min);
}

/** Liczba całkowita z [min, max] (włącznie). */
export function rngInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(rngNext(rng) * (max - min + 1));
}

/** Losowy element tablicy; `undefined` dla pustej tablicy. */
export function rngPick<T>(rng: RngState, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[rngInt(rng, 0, items.length - 1)];
}
