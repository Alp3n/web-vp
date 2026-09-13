/**
 * `Dir8` (przestrzeń siatki) -> klatka sprite'a.
 *
 * Atlas ma cztery narysowane kierunki: `ne`, `se`, `sw`, `nw` — to przekątne siatki,
 * czyli `Dir8` 1, 3, 5, 7 (kontrakt: `docs/architecture.md`, „Kierunki").
 * Na ekranie iso wychodzą one na osie: NE = w prawo, SE = w dół, SW = w lewo, NW = w górę.
 *
 * Cztery kierunki osiowe (N, E, S, W) leżą dokładnie pomiędzy dwoma narysowanymi,
 * więc mapujemy je jedną regułą: **zaokrąglamy zgodnie z ruchem wskazówek zegara**
 * (`dir + 1`), co daje N -> ne, E -> se, S -> sw, W -> nw. Reguła jest arbitralna
 * (odległość jest równa w obie strony), ale spójna i bez wyjątków.
 *
 * `flipX` jest w Fazie 1 **zawsze `false`**: wszystkie cztery kierunki są w atlasie
 * narysowane osobno (`assets/src/worker.ts` robi flip już na etapie pipeline'u), więc
 * render nie musi nic odbijać. Pole zostaje w kontrakcie na przyszłe sprite'y
 * rysowane tylko w dwóch kierunkach.
 */

import type { Dir8 } from '../sim';

/** Kierunki narysowane w atlasie. */
export type FrameDir = 'ne' | 'se' | 'sw' | 'nw';

export interface Facing {
  frameDir: FrameDir;
  flipX: boolean;
}

/** `Dir8` -> narysowany kierunek. Osiowe zaokrąglane w prawo (dir + 1). */
const FRAME_DIR: Record<Dir8, FrameDir> = {
  0: 'ne', // N  -> NE
  1: 'ne',
  2: 'se', // E  -> SE
  3: 'se',
  4: 'sw', // S  -> SW
  5: 'sw',
  6: 'nw', // W  -> NW
  7: 'nw',
};

export function facingFor(dir: Dir8): Facing {
  return { frameDir: FRAME_DIR[dir], flipX: false };
}

/** Klucz animacji: `worker_walk_se` / `worker_idle_ne` itp. */
export function animKey(kind: string, moving: boolean, dir: Dir8): string {
  return `${kind}_${moving ? 'walk' : 'idle'}_${FRAME_DIR[dir]}`;
}
