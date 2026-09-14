/**
 * Rąbanie drzew (kontrakt: `docs/architecture.md`, sekcja „Faza 2 — ekonomia i budowanie").
 *
 * Akcja `chop` trwa `worker.chopTicks` ticków. Po jej zakończeniu jednostka dostaje
 * `worker.chopWood` drewna, drzewo zmienia stan, a po `trees.chopsToStump` rąbnięciach
 * zostaje pieńkiem i przestaje blokować kafel.
 *
 * PRZERWANIE AKCJI JEST W JEDNYM MIEJSCU: `applyActionCommands`. Ta funkcja przechodzi
 * po komendach w kolejności ich nadejścia i obsługuje wszystkie trzy zdarzenia dotyczące
 * akcji: `chop` (start), `cancel` (przerwanie) i `move` z kierunkiem (przerwanie).
 * Dlatego w `tick.ts` woła się ją PO `applyMoveCommands` — wtedy „ostatnia komenda w tablicy
 * wygrywa": `chop` po `move` zeruje prędkość ustawioną przez ruch, a `move` po `chop`
 * kasuje akcję i przywraca zamiar ruchu (`setMoveIntent`, ten sam helper co w `movement.ts`).
 * `movement.ts` nie wie nic o akcjach.
 */

import { BALANCE } from '../balance';
import type { Command } from '../commands';
import type { Tree, Vec2, World } from '../types';
import { dirFromVector, tileIndex, treeById, unitById } from '../types';
import { setMoveIntent } from './movement';

const WORKER = BALANCE.worker;
const TREES = BALANCE.trees;

/** Środek kafla drzewa. */
function treeCenterX(tree: Tree): number {
  return tree.x + 0.5;
}

function treeCenterY(tree: Tree): number {
  return tree.y + 0.5;
}

/** Kwadrat odległości środka jednostki od środka kafla drzewa. */
function distSqToTree(x: number, y: number, tree: Tree): number {
  const dx = treeCenterX(tree) - x;
  const dy = treeCenterY(tree) - y;
  return dx * dx + dy * dy;
}

/** Drzewo nadające się do rąbania (pieńka nie da się rąbać). */
function isChoppable(tree: Tree): boolean {
  return tree.state !== 'stump';
}

/**
 * Najbliższe drzewo (nie pieniek) w promieniu `range` od punktu `pos`.
 * Czysta funkcja — używana przez HUD („czy pokazać przycisk rąbania") i przez AI.
 * Remis rozstrzyga kolejność w `world.trees` (deterministycznie).
 */
export function nearestChoppableTree(
  world: World,
  pos: Vec2,
  range: number = WORKER.interactRange,
): Tree | undefined {
  const maxSq = range * range;
  let best: Tree | undefined;
  let bestSq = Infinity;
  for (const tree of world.trees) {
    if (!isChoppable(tree)) continue;
    const d2 = distSqToTree(pos.x, pos.y, tree);
    if (d2 > maxSq || d2 >= bestSq) continue;
    best = tree;
    bestSq = d2;
  }
  return best;
}

/**
 * Czy jednostka może zacząć rąbać to drzewo: drzewo istnieje, nie jest pieńkiem,
 * a środek jednostki leży nie dalej niż `worker.interactRange` od środka kafla drzewa.
 */
export function canChop(world: World, unitId: number, treeId: number): boolean {
  const unit = unitById(world, unitId);
  const tree = treeById(world, treeId);
  if (!unit || !tree || !isChoppable(tree)) return false;
  const range = WORKER.interactRange;
  return distSqToTree(unit.pos.x, unit.pos.y, tree) <= range * range;
}

/**
 * Komendy akcji: `chop` (start), `cancel` i `move` z kierunkiem (przerwanie).
 * Kolejność komend w tablicy jest znacząca — patrz komentarz na górze pliku.
 */
export function applyActionCommands(world: World, commands: Command[]): void {
  for (const cmd of commands) {
    if (cmd.type === 'cancel') {
      const unit = unitById(world, cmd.unitId);
      if (unit) unit.action = null;
      continue;
    }
    if (cmd.type === 'move') {
      // `dir: null` (stop) nie przerywa akcji — kontrakt mówi wyłącznie o ruchu z kierunkiem.
      if (cmd.dir === null) continue;
      const unit = unitById(world, cmd.unitId);
      if (!unit || unit.action === null) continue;
      unit.action = null;
      setMoveIntent(unit, cmd.dir);
      continue;
    }
    if (cmd.type !== 'chop') continue;
    const unit = unitById(world, cmd.unitId);
    const tree = treeById(world, cmd.treeId);
    if (!unit || !tree || !isChoppable(tree)) continue;
    const range = WORKER.interactRange;
    if (distSqToTree(unit.pos.x, unit.pos.y, tree) > range * range) continue;
    unit.action = { type: 'chop', treeId: tree.id, ticksLeft: WORKER.chopTicks };
    // Rąbanie zatrzymuje jednostkę i obraca ją w stronę drzewa.
    unit.vel.x = 0;
    unit.vel.y = 0;
    unit.moving = false;
    const facing = dirFromVector(treeCenterX(tree) - unit.pos.x, treeCenterY(tree) - unit.pos.y);
    if (facing !== null) unit.facing = facing;
  }
}

/**
 * Tick akcji jednostek (na razie tylko `chop`): odlicza `ticksLeft`, a po dojściu do 0
 * nalicza drewno i zmienia stan drzewa. Pieniek przestaje blokować kafel.
 */
export function tickChopping(world: World): void {
  for (const unit of world.units) {
    const action = unit.action;
    if (action === null || action.type !== 'chop') continue;
    const tree = treeById(world, action.treeId);
    // Drzewo zniknęło albo ktoś je dorąbał wcześniej — akcja kończy się bez nagrody.
    if (!tree || !isChoppable(tree)) {
      unit.action = null;
      continue;
    }
    action.ticksLeft -= 1;
    if (action.ticksLeft > 0) continue;
    unit.action = null;
    world.wood += WORKER.chopWood;
    tree.chops += 1;
    tree.wood -= WORKER.chopWood;
    if (tree.chops >= TREES.chopsToStump) {
      tree.state = 'stump';
      const idx = tileIndex(world, tree.x, tree.y);
      if (idx >= 0) world.blocked[idx] = 0;
    } else if (tree.chops >= 1) {
      tree.state = 'chopped';
    }
  }
}
