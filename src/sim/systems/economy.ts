/**
 * Ekonomia pasywna (kontrakt: `docs/architecture.md`, sekcja „Faza 2").
 * Faza 2 ma tylko tartak: daje `sawmill.woodPerSecond` drewna na sekundę, o ile
 * w promieniu `sawmill.treeRadiusTiles` od środka footprintu stoi choć jedno drzewo
 * (`full` albo `chopped` — pieniek się nie liczy) i budowa jest zakończona.
 *
 * WYDAJNOŚĆ: drzewa liczymy RAZ NA SEKUNDĘ (gdy `tick % TICK_RATE === 0`), nie co tick,
 * i wtedy dopisujemy do `woodFrac` całą sekundę produkcji. Alternatywą był cache „czy są
 * drzewa w promieniu" per budynek, ale cache musiałby żyć poza `World` (w module), a wtedy
 * `cloneWorld` dawałby świat z innym cache i determinizm by się posypał. Stan trzymany
 * w `World` to z kolei zmiana kontraktu typu `Building`. Wybrane rozwiązanie nie wymaga
 * żadnego dodatkowego stanu, kosztuje 1/20 pracy i nie zmienia tempa produkcji (2 drewna/s).
 * Widoczna różnica: drewno dochodzi porcjami raz na sekundę zamiast po 0,1 co tick.
 */

import { BALANCE, TICK_RATE } from '../balance';
import type { Building, World } from '../types';

const SAWMILL = BALANCE.buildings.sawmill;

/** Środek footprintu budynku (w kaflach). */
function centerX(b: Building): number {
  return b.x + b.w / 2;
}

function centerY(b: Building): number {
  return b.y + b.h / 2;
}

/**
 * Czy w promieniu `radius` od środka footprintu jest drzewo nadające się do ścięcia
 * (`full` albo `chopped`). Odległość liczona do środka kafla drzewa.
 */
export function hasTreeInRadius(
  world: World,
  b: Building,
  radius: number = SAWMILL.treeRadiusTiles,
): boolean {
  const cx = centerX(b);
  const cy = centerY(b);
  const r2 = radius * radius;
  for (const tree of world.trees) {
    if (tree.state === 'stump') continue;
    const dx = tree.x + 0.5 - cx;
    const dy = tree.y + 0.5 - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** Czy tartak produkuje w tej chwili (gotowy i ma drzewa w promieniu). */
export function sawmillProduces(world: World, b: Building): boolean {
  if (b.kind !== 'sawmill' || b.buildTicksLeft > 0) return false;
  return hasTreeInRadius(world, b);
}

/**
 * Ekonomia jednego ticku. Raz na sekundę dolicza produkcję tartaków do `woodFrac`,
 * po czym przenosi część całkowitą do `wood`.
 */
export function tickEconomy(world: World): void {
  if (world.tick % TICK_RATE === 0) {
    for (const building of world.buildings) {
      if (!sawmillProduces(world, building)) continue;
      world.woodFrac += SAWMILL.woodPerSecond;
    }
  }
  if (world.woodFrac >= 1) {
    const whole = Math.floor(world.woodFrac);
    world.wood += whole;
    world.woodFrac -= whole;
  }
}
