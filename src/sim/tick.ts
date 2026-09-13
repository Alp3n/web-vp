/**
 * Pojedynczy krok symulacji (20 Hz). Mutuje i zwraca ten sam obiekt `World`.
 * Kolejność systemów jest częścią kontraktu determinizmu — nie zmieniaj jej
 * bez wpisu w `docs/decisions.md`.
 */

import type { Command } from './commands';
import { applyMoveCommands, moveUnits } from './systems/movement';
import type { World } from './types';

export function step(world: World, commands: Command[]): World {
  // 1. Komendy ruchu -> vel / facing / moving.
  applyMoveCommands(world, commands);
  // 2. Ruch z kolizjami.
  moveUnits(world);
  // 3. Faza 2: rąbanie (`chop`), budowanie (`build`), `cancel` — na razie no-op.
  world.tick += 1;
  return world;
}
