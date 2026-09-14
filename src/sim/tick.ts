/**
 * Pojedynczy krok symulacji (20 Hz). Mutuje i zwraca ten sam obiekt `World`.
 * Kolejność systemów jest częścią kontraktu determinizmu (docs/architecture.md:
 * komendy → ruch → akcje jednostek → konstrukcja → ekonomia → tick++) — nie zmieniaj
 * jej bez wpisu w `docs/decisions.md`.
 */

import type { Command } from './commands';
import { applyBuildCommands, tickConstruction } from './systems/building';
import { applyActionCommands, tickChopping } from './systems/chopping';
import { tickEconomy } from './systems/economy';
import { applyMoveCommands, moveUnits } from './systems/movement';
import type { World } from './types';

export function step(world: World, commands: Command[]): World {
  // 1a. Komendy ruchu -> vel / facing / moving.
  applyMoveCommands(world, commands);
  // 1b. Komendy akcji: `chop` (start), `cancel` i `move` z kierunkiem (przerwanie).
  //     PO ruchu, żeby przy kilku komendach w jednym ticku wygrywała ostatnia z tablicy.
  applyActionCommands(world, commands);
  // 1c. Komendy budowy (walidacja w `canPlaceBuilding`).
  applyBuildCommands(world, commands);
  // 2. Ruch z kolizjami.
  moveUnits(world);
  // 3. Akcje jednostek trwające wiele ticków (rąbanie).
  tickChopping(world);
  // 4. Konstrukcja budynków (bez robotnika).
  tickConstruction(world);
  // 5. Ekonomia pasywna (tartaki).
  tickEconomy(world);
  world.tick += 1;
  return world;
}
