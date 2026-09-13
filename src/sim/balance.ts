/**
 * Wszystkie liczby balansu i geometrii w jednym miejscu (PLAN.md §4 + docs/architecture.md).
 * Nigdy nie wpisuj liczb balansu inline w systemach — dodaj je tutaj.
 *
 * Jednostki:
 *  - czas: ticki (20 Hz). `s(x)` przelicza sekundy na ticki.
 *  - odległość/pozycja: kafle (float) w przestrzeni siatki.
 *  - prędkość: kafle na sekundę (mnożnik z planu 1.0 = 4 kafle/s).
 */

// ——— Geometria i czas (kontrakt: docs/architecture.md) ———
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE; // 50
export const MAP_W = 64;
export const MAP_H = 64;
export const TILE_W = 32;
export const TILE_H = 16;
export const UNIT_RADIUS = 0.3;

/** Sekundy -> ticki (zaokrąglone w górę do pełnego ticka). */
export const s = (seconds: number): number => Math.round(seconds * TICK_RATE);

/** Mnożnik prędkości z planu (1.0) wyrażony w kaflach na sekundę. */
export const SPEED_UNIT_TILES_PER_S = 4;
export const WORKER_SPEED_TILES_PER_S = 4; // plan: 1.0
export const VAMPIRE_SPEED_TILES_PER_S = 4.6; // plan: 1.15

export const BALANCE = {
  sim: {
    tickRate: TICK_RATE,
    tickMs: TICK_MS,
    mapW: MAP_W,
    mapH: MAP_H,
    tileW: TILE_W,
    tileH: TILE_H,
    unitRadius: UNIT_RADIUS,
  },

  round: {
    /** 12 minut rundy. */
    durationSeconds: 12 * 60,
    durationTicks: s(12 * 60), // 14400
    /** Co ile ticków rosną statystyki wampira (co minutę). */
    vampireGrowthIntervalTicks: s(60),
  },

  worker: {
    hp: 100,
    maxHp: 100,
    speedTilesPerS: WORKER_SPEED_TILES_PER_S,
    /** Rąbanie: 5 s -> 10 drewna. */
    chopTicks: s(5),
    chopWood: 10,
    /** Zasięg interakcji (rąbanie, budowa, naprawa) w kaflach. */
    interactRange: 1.2,
    /** Naprawa muru: HP na sekundę (start, do tuningu w Fazie 4). */
    repairHpPerSecond: 40,
  },

  vampire: {
    hp: 800,
    maxHp: 800,
    damage: 40,
    speedTilesPerS: VAMPIRE_SPEED_TILES_PER_S,
    attackRange: 1.0,
    attackIntervalTicks: s(1),
    /** Regeneracja 2% maxHP/s poza walką. */
    regenPercentPerSecond: 0.02,
    /** Ile sekund bez obrażeń liczy się jako „poza walką". */
    outOfCombatSeconds: 5,
    outOfCombatTicks: s(5),
    /** Co minutę: +5% dmg, +5% HP. */
    growthDamagePerMinute: 0.05,
    growthHpPerMinute: 0.05,
    skills: {
      sprint: {
        durationTicks: s(3),
        cooldownTicks: s(20),
        /** Mnożnik prędkości podczas sprintu (start, do tuningu). */
        speedMultiplier: 1.5,
      },
      smell: {
        /** „Węch": 2 s widzi kierunek do najbliższego człowieka. */
        durationTicks: s(2),
        cooldownTicks: s(45),
      },
    },
  },

  buildings: {
    wall: {
      woodCost: 50,
      hp: 400,
      footprint: { w: 1, h: 1 },
      buildTicks: s(1),
    },
    tower: {
      woodCost: 150,
      hp: 300,
      damage: 20,
      rangeTiles: 5,
      /** 1 strzał na sekundę. */
      fireIntervalTicks: s(1),
      projectileSpeedTilesPerS: 12,
      footprint: { w: 1, h: 1 },
      buildTicks: s(3),
    },
    sawmill: {
      woodCost: 100,
      hp: 500,
      /** Pasywnie +2 drewna/s, jeśli w promieniu są drzewa. */
      woodPerSecond: 2,
      treeRadiusTiles: 6,
      footprint: { w: 2, h: 2 },
      buildTicks: s(5),
    },
    generator: {
      woodCost: 200,
      hp: 500,
      goldPerSecond: 1,
      footprint: { w: 2, h: 2 },
      buildTicks: s(5),
    },
  },

  upgrades: {
    maxLevel: 3,
    /** +50% na poziom (mnożnik bazowej wartości). */
    wallHpPerLevel: 0.5,
    towerDamagePerLevel: 0.5,
    /** Koszt w złocie za poziom (start, do tuningu w Fazie 4). */
    goldCostPerLevel: [15, 30, 60],
  },

  economy: {
    startingWood: 0,
    startingGold: 0,
  },

  ai: {
    /** Sensory wampira (PLAN.md §5) — w kaflach. */
    hearChopRadiusTiles: 12,
    hearTowerShotRadiusTiles: 20,
    sightRadiusTiles: 10,
    /** RETREAT poniżej 30% HP. */
    retreatHpFraction: 0.3,
    /** SIEGE -> odwrót, gdy wieże zadają więcej niż tyle dmg/s. */
    siegeAbortDamagePerSecond: 15,
    /** Ile ticków wampir trzyma cel po utracie linii wzroku. */
    huntMemoryTicks: s(8),
    /** Jak długo wampir eksploruje jeden punkt w ROAM. */
    roamRepathTicks: s(6),
    /** Koszt przejścia przez mur w A*: hp muru / dmg wampira (w tickach). */
    wallPathCostDivisorDamage: 40,
  },
} as const;

export type Balance = typeof BALANCE;
