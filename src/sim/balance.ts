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

// ——— Wywyższenia (kontrakt: docs/architecture.md, sekcja „Wywyższenia") ———
/** Ile poziomów terenu: 0 = ziemia, 1 = płaskowyż. */
export const ELEV_LEVELS = 2;
/** O ile pikseli (1×) wyżej rysowany jest poziom 1 — wysokość ściany klifu. */
export const ELEV_PX = 10;

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
    /** Krótszy wektor wejścia niż to = brak kierunku (`dirFromVector` -> null). */
    dirMinLength: 0.001,
    elevLevels: ELEV_LEVELS,
    elevPx: ELEV_PX,
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

  /** Tryb budowy (kontrakt: docs/architecture.md, „Faza 2 — ekonomia i budowanie"). */
  build: {
    /**
     * Maksymalna odległość (kafle) środka jednostki od najbliższego kafla footprintu,
     * przy której komenda `build` jest przyjmowana.
     */
    rangeTiles: 5,
    /** Rodzaje dostępne w Fazie 2; reszta odrzucana z powodem „niedostępne w tej fazie". */
    availableKinds: ['wall', 'sawmill'],
    /** Poziom ulepszenia nowego budynku. */
    startLevel: 0,
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

  trees: {
    /** Ile drewna ma pełne drzewo (3 rąbnięcia po 10). */
    woodPerTree: 30,
    /** Ile rąbnięć zamienia pełne drzewo w pień (Faza 2). */
    chopsToStump: 3,
  },

  /**
   * Parametry generatora mapy (`src/sim/world.ts`). Wszystko deterministyczne:
   * każdy losowy wybór idzie przez `rngNext(world.rng)`.
   */
  mapgen: {
    grass: {
      /** Rozmiar komórki value-noise (w kaflach) — im większy, tym większe plamy. */
      cellLarge: 9,
      cellSmall: 4,
      /** Waga oktawy „dużej" (reszta idzie do małej). */
      weightLarge: 0.65,
      /** Udziały wariantów trawy: 60 / 25 / 15 % (kwantyle szumu). */
      shareGrass0: 0.6,
      shareGrass1: 0.25,
    },
    dirt: {
      patchesMin: 3,
      patchesMax: 6,
      radiusMin: 2.5,
      radiusMax: 5.5,
      pathsMin: 1,
      pathsMax: 2,
      pathStepsMin: 18,
      pathStepsMax: 36,
      pathHalfWidth: 1.2,
      /** Margines od krawędzi mapy (kafle), żeby ziemia nie wchodziła w wodę. */
      margin: 4,
    },
    water: {
      /** Pierścień wody na krawędzi mapy (kafle). */
      borderRing: 1,
      covesMin: 3,
      covesMax: 6,
      coveRadiusMin: 2,
      coveRadiusMax: 4.5,
      /** Jak głęboko w ląd może sięgnąć zatoczka (kafle od krawędzi). */
      coveMaxDepth: 5,
    },
    clearings: {
      countMin: 3,
      countMax: 4,
      radiusMin: 5,
      radiusMax: 7,
      /** Maksymalne przesunięcie polany startowej od środka mapy (kafle). */
      startOffsetMax: 4,
      /** Margines od krawędzi dla pozostałych polan (kafle). */
      margin: 10,
      /** Wokół startu w tym promieniu nigdy nie ma drzewa (kafle). */
      startSafeRadius: 4.5,
    },
    treeClusters: {
      countMin: 6,
      countMax: 10,
      radiusMin: 4,
      radiusMax: 8,
      /** Margines od krawędzi dla środków skupisk (kafle). */
      margin: 6,
      /**
       * Wykładnik promienia przy losowaniu punktu: d = r * u^exp.
       * exp < 0.5 zagęszcza brzegi, exp > 0.5 zagęszcza środek (gęstość maleje od środka).
       */
      radialExponent: 0.9,
      /** Łączna liczba drzew na mapie (PLAN: ok. 500–700). */
      totalMin: 540,
      totalMax: 660,
      /** Jaka część drzew to rzadkie pojedyncze sztuki poza skupiskami. */
      scatteredFraction: 0.12,
      /** Budżet prób losowania na jedno drzewo (ochrona przed pętlą). */
      attemptsPerTree: 40,
    },
    /**
     * Płaskowyże (poziom 1). Bloby o „poszarpanym" brzegu, wejście wyłącznie rampą
     * szerokości 2; reszta krawędzi to klif (nieprzejezdny).
     */
    plateaus: {
      countMin: 2,
      countMax: 4,
      radiusMin: 5,
      radiusMax: 9,
      /** Amplituda szumu brzegu jako ułamek promienia (0 = idealne koło). */
      edgeNoise: 0.14,
      /** Margines od krawędzi mapy dla kafli płaskowyżu (kafle). */
      margin: 6,
      /** Żaden kafel płaskowyżu nie leży bliżej startu robotnika niż tyle kafli. */
      minDistanceFromStart: 12,
      /** Minimalny odstęp od wody (kafle) — żeby dało się obejść płaskowyż brzegiem. */
      minDistanceFromWater: 2,
      /** Minimalny odstęp między płaskowyżami (kafle) — bloby nigdy się nie stykają. */
      minGap: 3,
      /** Budżet prób losowania jednego bloba. */
      placementAttempts: 60,
      rampsMin: 1,
      rampsMax: 2,
      /** Szerokość rampy w kaflach (kontrakt: 2). */
      rampWidth: 2,
      /** Minimalny odstęp (Czebyszew) między dwiema rampami tego samego płaskowyżu. */
      rampMinGap: 3,
      /**
       * Ile razy generator może „otworzyć drzwi" (usunąć drzewo/głaz), żeby każdy
       * niezablokowany kafel płaskowyżu był osiągalny ze startu.
       */
      reachabilityDoors: 64,
    },
    /** Głazy: statyczne blokery poza polaną startową i korytarzami ramp. */
    rocks: {
      countMin: 20,
      countMax: 40,
      /** Wokół startu w tym promieniu nie ma głazów (kafle). */
      startSafeRadius: 5,
      /** Szansa na duży głaz (`size = 1`). */
      bigChance: 0.35,
      /** Budżet prób losowania na jeden głaz. */
      attemptsPerRock: 40,
    },
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
