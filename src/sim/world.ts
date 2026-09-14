/**
 * Generator świata, klonowanie i kanoniczny hash stanu.
 * Cała losowość idzie przez `rngNext(world.rng)` — kolejność wywołań jest stała,
 * więc ten sam seed zawsze daje ten sam świat (DoD Fazy 1).
 */

import { BALANCE, MAP_H, MAP_W } from './balance';
import { rngInt, rngNext, rngRange } from './rng';
import { canCross, canCrossTerrain, rampDirVector } from './systems/terrain';
import type { RampDir, Rock, Tree, Unit, World } from './types';
import { TILE_DIRT, TILE_GRASS0, TILE_GRASS1, TILE_GRASS2, TILE_WATER } from './types';

const MAPGEN = BALANCE.mapgen;

interface Disc {
  x: number;
  y: number;
  r: number;
}

interface TilePos {
  x: number;
  y: number;
}

/** Pusty świat bez terenu i jednostek (przydatny w testach i jako baza generatora). */
export function createEmptyWorld(seed: number, w: number, h: number): World {
  return {
    seed,
    tick: 0,
    width: w,
    height: h,
    tiles: new Uint8Array(w * h),
    blocked: new Uint8Array(w * h),
    elevation: new Uint8Array(w * h),
    ramp: new Uint8Array(w * h),
    trees: [],
    rocks: [],
    units: [],
    wood: BALANCE.economy.startingWood,
    gold: BALANCE.economy.startingGold,
    nextId: 1,
    rng: { state: seed | 0 },
  };
}

// ——— Value noise (hash-based, seedowany) ———

/** Deterministyczny hash 2D -> [0, 1). Bez `Math.random`. */
function hash2D(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise 2D na siatce o boku `cell` kafli, interpolacja smoothstep. */
function valueNoise(seed: number, x: number, y: number, cell: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smoothstep(fx - ix);
  const ty = smoothstep(fy - iy);
  const n00 = hash2D(seed, ix, iy);
  const n10 = hash2D(seed, ix + 1, iy);
  const n01 = hash2D(seed, ix, iy + 1);
  const n11 = hash2D(seed, ix + 1, iy + 1);
  const top = n00 + (n10 - n00) * tx;
  const bottom = n01 + (n11 - n01) * tx;
  return top + (bottom - top) * ty;
}

// ——— Teren ———

/**
 * Trawa 0/1/2 z dwuoktawowego value-noise. Progi wariantów to kwantyle rozkładu
 * (60 / 25 / 15 %), więc proporcje są stabilne niezależnie od seeda, a plamy
 * zostają plamami zamiast szumu per kafel.
 */
function paintGrass(world: World): void {
  const noiseSeed = (rngNext(world.rng) * 0xffffffff) | 0;
  const { cellLarge, cellSmall, weightLarge, shareGrass0, shareGrass1 } = MAPGEN.grass;
  const values = new Float64Array(world.width * world.height);
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const big = valueNoise(noiseSeed, x, y, cellLarge);
      const small = valueNoise(noiseSeed ^ 0x5bf03635, x, y, cellSmall);
      values[y * world.width + x] = big * weightLarge + small * (1 - weightLarge);
    }
  }
  const sorted = Array.from(values).sort((a, b) => a - b);
  const q0 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * shareGrass0))] ?? 0;
  const q1 =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (shareGrass0 + shareGrass1)))] ?? 1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    world.tiles[i] = v < q0 ? TILE_GRASS0 : v < q1 ? TILE_GRASS1 : TILE_GRASS2;
  }
}

function paintDisc(world: World, cx: number, cy: number, r: number, kind: number): void {
  const r2 = r * r;
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(world.width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(world.height - 1, Math.ceil(cy + r));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) world.tiles[y * world.width + x] = kind;
    }
  }
}

/** Kilka plam ziemi + parę „ścieżek" (błądzenie losowe pędzlem). */
function paintDirt(world: World): void {
  const cfg = MAPGEN.dirt;
  const m = cfg.margin;
  const patches = rngInt(world.rng, cfg.patchesMin, cfg.patchesMax);
  for (let i = 0; i < patches; i++) {
    const cx = rngRange(world.rng, m, world.width - m);
    const cy = rngRange(world.rng, m, world.height - m);
    const r = rngRange(world.rng, cfg.radiusMin, cfg.radiusMax);
    paintDisc(world, cx, cy, r, TILE_DIRT);
  }
  const paths = rngInt(world.rng, cfg.pathsMin, cfg.pathsMax);
  for (let i = 0; i < paths; i++) {
    let x = rngRange(world.rng, m, world.width - m);
    let y = rngRange(world.rng, m, world.height - m);
    let angle = rngNext(world.rng) * Math.PI * 2;
    const steps = rngInt(world.rng, cfg.pathStepsMin, cfg.pathStepsMax);
    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      angle += (rngNext(world.rng) - 0.5) * 0.8;
      x = Math.min(world.width - m, Math.max(m, x + Math.cos(angle)));
      y = Math.min(world.height - m, Math.max(m, y + Math.sin(angle)));
      paintDisc(world, x, y, cfg.pathHalfWidth, TILE_DIRT);
    }
  }
}

/** Woda tylko przy krawędzi: pierścień 1 kafla + parę zatoczek wchodzących w ląd. */
function paintWater(world: World): void {
  const cfg = MAPGEN.water;
  const ring = cfg.borderRing;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (x < ring || y < ring || x >= world.width - ring || y >= world.height - ring) {
        world.tiles[y * world.width + x] = TILE_WATER;
      }
    }
  }
  const coves = rngInt(world.rng, cfg.covesMin, cfg.covesMax);
  for (let i = 0; i < coves; i++) {
    const side = rngInt(world.rng, 0, 3);
    const along = rngRange(world.rng, cfg.coveMaxDepth, world.width - cfg.coveMaxDepth);
    const depth = rngRange(world.rng, 0, cfg.coveMaxDepth);
    const r = rngRange(world.rng, cfg.coveRadiusMin, cfg.coveRadiusMax);
    let cx = along;
    let cy = along;
    if (side === 0) cy = depth;
    else if (side === 1) cy = world.height - depth;
    else if (side === 2) cx = depth;
    else cx = world.width - depth;
    paintDisc(world, cx, cy, r, TILE_WATER);
  }
  // Woda blokuje ruch.
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] === TILE_WATER) world.blocked[i] = 1;
  }
}

// ——— Polany, drzewa, jednostka startowa ———

/** Polany: pierwsza (startowa) w okolicy środka mapy, reszta losowo. */
function pickClearings(world: World): Disc[] {
  const cfg = MAPGEN.clearings;
  const count = rngInt(world.rng, cfg.countMin, cfg.countMax);
  const clearings: Disc[] = [];
  const offX = rngInt(world.rng, -cfg.startOffsetMax, cfg.startOffsetMax);
  const offY = rngInt(world.rng, -cfg.startOffsetMax, cfg.startOffsetMax);
  clearings.push({
    x: Math.floor(world.width / 2) + offX + 0.5,
    y: Math.floor(world.height / 2) + offY + 0.5,
    r: rngRange(world.rng, cfg.radiusMin, cfg.radiusMax),
  });
  for (let i = 1; i < count; i++) {
    clearings.push({
      x: rngRange(world.rng, cfg.margin, world.width - cfg.margin),
      y: rngRange(world.rng, cfg.margin, world.height - cfg.margin),
      r: rngRange(world.rng, cfg.radiusMin, cfg.radiusMax),
    });
  }
  return clearings;
}

/** Wolny kafel jak najbliżej środka polany startowej (spirala, bez losowości). */
function pickStartTile(world: World, clearing: Disc): TilePos {
  const cx = Math.floor(clearing.x);
  const cy = Math.floor(clearing.y);
  for (let radius = 0; radius < Math.max(world.width, world.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= world.width - 1 || y >= world.height - 1) continue;
        if (world.blocked[y * world.width + x] === 1) continue;
        return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

function inAnyClearing(clearings: readonly Disc[], x: number, y: number): boolean {
  for (const c of clearings) {
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) return true;
  }
  return false;
}

function plantTree(
  world: World,
  tx: number,
  ty: number,
  clearings: readonly Disc[],
  start: TilePos,
): boolean {
  if (tx < 1 || ty < 1 || tx >= world.width - 1 || ty >= world.height - 1) return false;
  const idx = ty * world.width + tx;
  if (world.blocked[idx] === 1) return false;
  if (world.tiles[idx] === TILE_WATER) return false;
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  if (inAnyClearing(clearings, cx, cy)) return false;
  const sdx = cx - (start.x + 0.5);
  const sdy = cy - (start.y + 0.5);
  const safe = MAPGEN.clearings.startSafeRadius;
  if (sdx * sdx + sdy * sdy <= safe * safe) return false;
  const tree: Tree = {
    id: world.nextId++,
    x: tx,
    y: ty,
    wood: BALANCE.trees.woodPerTree,
    state: 'full',
  };
  world.trees.push(tree);
  world.blocked[idx] = 1;
  return true;
}

/**
 * Drzewa: kilka skupisk (gęstość maleje od środka) + rzadkie pojedyncze sztuki.
 * Losujemy punkty, a nie przechodzimy po kaflach — dzięki temu łączna liczba
 * drzew mieści się w zadanym przedziale niezależnie od tego, ile miejsca zajęły
 * polany i woda.
 */
function plantTrees(world: World, clearings: readonly Disc[], start: TilePos): void {
  const cfg = MAPGEN.treeClusters;
  const clusterCount = rngInt(world.rng, cfg.countMin, cfg.countMax);
  const clusters: Disc[] = [];
  let weightSum = 0;
  const weights: number[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const c: Disc = {
      x: rngRange(world.rng, cfg.margin, world.width - cfg.margin),
      y: rngRange(world.rng, cfg.margin, world.height - cfg.margin),
      r: rngRange(world.rng, cfg.radiusMin, cfg.radiusMax),
    };
    clusters.push(c);
    weightSum += c.r * c.r;
    weights.push(weightSum);
  }

  const total = rngInt(world.rng, cfg.totalMin, cfg.totalMax);
  const scattered = Math.round(total * cfg.scatteredFraction);
  const clusterTarget = total - scattered;

  let placed = 0;
  let attempts = 0;
  const clusterBudget = clusterTarget * cfg.attemptsPerTree;
  while (placed < clusterTarget && attempts < clusterBudget) {
    attempts++;
    const pick = rngNext(world.rng) * weightSum;
    let ci = clusters.length - 1;
    for (let i = 0; i < weights.length; i++) {
      if (pick < (weights[i] ?? 0)) {
        ci = i;
        break;
      }
    }
    const cluster = clusters[ci];
    if (!cluster) break;
    // d = r * u^exp, exp > 0.5 => gęstość maleje od środka skupiska.
    const d = cluster.r * Math.pow(rngNext(world.rng), cfg.radialExponent);
    const angle = rngNext(world.rng) * Math.PI * 2;
    const tx = Math.floor(cluster.x + Math.cos(angle) * d);
    const ty = Math.floor(cluster.y + Math.sin(angle) * d);
    if (plantTree(world, tx, ty, clearings, start)) placed++;
  }

  // Pojedyncze drzewa (i uzupełnienie, gdyby skupiska nie wyrobiły normy).
  let scatterAttempts = 0;
  const scatterBudget = (total - placed) * cfg.attemptsPerTree;
  while (placed < total && scatterAttempts < scatterBudget) {
    scatterAttempts++;
    const tx = rngInt(world.rng, 1, world.width - 2);
    const ty = rngInt(world.rng, 1, world.height - 2);
    if (plantTree(world, tx, ty, clearings, start)) placed++;
  }
}

function spawnWorker(world: World, start: TilePos): Unit {
  const worker: Unit = {
    id: world.nextId++,
    kind: 'worker',
    pos: { x: start.x + 0.5, y: start.y + 0.5 },
    vel: { x: 0, y: 0 },
    facing: 3, // SE — jeden z czterech rysowanych kierunków
    moving: false,
    hp: BALANCE.worker.hp,
    maxHp: BALANCE.worker.maxHp,
    speed: BALANCE.worker.speedTilesPerS,
  };
  world.units.push(worker);
  return worker;
}

// ——— Wywyższenia: płaskowyże, rampy, głazy ———

/** Sąsiedzi ortogonalni w stałej kolejności N, E, S, W. */
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

interface Plateau {
  cx: number;
  cy: number;
  r: number;
  /** Fazy szumu brzegu — brzeg to lekko „poszarpane" koło, nie idealny okrąg. */
  phase1: number;
  phase2: number;
  /** Indeksy kafli poziomu 1. */
  tiles: number[];
  /** Indeksy kafli rampy (2 na rampę). */
  rampTiles: number[];
}

/** Maksymalny promień bloba po doliczeniu szumu brzegu. */
function outerRadius(r: number): number {
  return r * (1 + MAPGEN.plateaus.edgeNoise);
}

/** Promień bloba pod danym kątem (lekki szum brzegu, deterministyczny per płaskowyż). */
function blobRadius(p: Plateau, angle: number): number {
  const noise = 0.6 * Math.sin(3 * angle + p.phase1) + 0.4 * Math.sin(2 * angle + p.phase2);
  return p.r * (1 + MAPGEN.plateaus.edgeNoise * noise);
}

function isWaterTile(world: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return true;
  return world.tiles[ty * world.width + tx] === TILE_WATER;
}

/** Czy w promieniu `d` kafli (Czebyszew) od (tx, ty) jest woda albo krawędź mapy. */
function waterNear(world: World, tx: number, ty: number, d: number): boolean {
  for (let y = ty - d; y <= ty + d; y++) {
    for (let x = tx - d; x <= tx + d; x++) {
      if (isWaterTile(world, x, y)) return true;
    }
  }
  return false;
}

/** Usuwa z kafla drzewo/głaz i odblokowuje go (woda zostaje zablokowana). */
function clearObstacle(world: World, idx: number): void {
  const tx = idx % world.width;
  const ty = (idx - tx) / world.width;
  const treeIndex = world.trees.findIndex((t) => t.x === tx && t.y === ty);
  if (treeIndex >= 0) world.trees.splice(treeIndex, 1);
  const rockIndex = world.rocks.findIndex((r) => r.x === tx && r.y === ty);
  if (rockIndex >= 0) world.rocks.splice(rockIndex, 1);
  if (world.tiles[idx] !== TILE_WATER) world.blocked[idx] = 0;
}

/**
 * Kafle bloba. `null`, gdy kandydat łamie któryś warunek (margines mapy, woda,
 * dystans od startu, kolizja z innym płaskowyżem) — wtedy losujemy następnego.
 */
function plateauTiles(world: World, p: Plateau, start: TilePos): number[] | null {
  const cfg = MAPGEN.plateaus;
  const rMax = outerRadius(p.r);
  const minX = Math.floor(p.cx - rMax) - 1;
  const maxX = Math.ceil(p.cx + rMax) + 1;
  const minY = Math.floor(p.cy - rMax) - 1;
  const maxY = Math.ceil(p.cy + rMax) + 1;
  const startX = start.x + 0.5;
  const startY = start.y + 0.5;
  const minStart2 = cfg.minDistanceFromStart * cfg.minDistanceFromStart;
  const tiles: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - p.cx;
      const dy = y + 0.5 - p.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > blobRadius(p, Math.atan2(dy, dx))) continue;
      if (x < cfg.margin || y < cfg.margin) return null;
      if (x >= world.width - cfg.margin || y >= world.height - cfg.margin) return null;
      const idx = y * world.width + x;
      if (world.elevation[idx] !== 0) return null;
      if (waterNear(world, x, y, cfg.minDistanceFromWater)) return null;
      const sdx = x + 0.5 - startX;
      const sdy = y + 0.5 - startY;
      if (sdx * sdx + sdy * sdy < minStart2) return null;
      tiles.push(idx);
    }
  }
  return tiles.length > 0 ? tiles : null;
}

/** 2–4 bloby poziomu 1, z odstępem `minGap` między sobą i od wody/startu. */
function raisePlateaus(world: World, start: TilePos): Plateau[] {
  const cfg = MAPGEN.plateaus;
  const count = rngInt(world.rng, cfg.countMin, cfg.countMax);
  const plateaus: Plateau[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < cfg.placementAttempts; attempt++) {
      const candidate: Plateau = {
        cx: rngRange(world.rng, cfg.margin, world.width - cfg.margin),
        cy: rngRange(world.rng, cfg.margin, world.height - cfg.margin),
        r: rngRange(world.rng, cfg.radiusMin, cfg.radiusMax),
        phase1: rngNext(world.rng) * Math.PI * 2,
        phase2: rngNext(world.rng) * Math.PI * 2,
        tiles: [],
        rampTiles: [],
      };
      // Odstęp między płaskowyżami: okrąg kandydata + minGap nie może zahaczyć o inny.
      let overlaps = false;
      for (const other of plateaus) {
        const dx = candidate.cx - other.cx;
        const dy = candidate.cy - other.cy;
        const need = outerRadius(candidate.r) + outerRadius(other.r) + cfg.minGap;
        if (dx * dx + dy * dy < need * need) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      const tiles = plateauTiles(world, candidate, start);
      if (!tiles) continue;
      candidate.tiles = tiles;
      for (const idx of tiles) world.elevation[idx] = 1;
      plateaus.push(candidate);
      break;
    }
  }
  return plateaus;
}

/** Obniża płaskowyż do poziomu 0 (używane, gdy nie da się zbudować żadnej rampy). */
function lowerPlateau(world: World, plateau: Plateau): void {
  for (const idx of plateau.tiles) world.elevation[idx] = 0;
  plateau.tiles = [];
}

/**
 * Osiągalność „po terenie": woda blokuje, drzewa i głazy nie (te generator może
 * usunąć). Służy do wyboru ramp tak, żeby ich podnóże leżało po stronie startu.
 */
function groundReachable(world: World, start: TilePos): Uint8Array {
  const seen = new Uint8Array(world.width * world.height);
  const first = start.y * world.width + start.x;
  const queue: number[] = [first];
  seen[first] = 1;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head] ?? 0;
    const x = idx % world.width;
    const y = (idx - x) / world.width;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      const nIdx = ny * world.width + nx;
      if (seen[nIdx] === 1) continue;
      if (world.tiles[nIdx] === TILE_WATER) continue;
      if (!canCrossTerrain(world, x, y, nx, ny)) continue;
      seen[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  return seen;
}

interface RampCandidate {
  dir: RampDir;
  tiles: [number, number];
}

/** Czy kafel nadaje się na połowę rampy o kierunku `dir` prowadzącej na `plateau`. */
function rampTileOk(
  world: World,
  tx: number,
  ty: number,
  dir: RampDir,
  plateau: Set<number>,
  ground: Uint8Array,
): boolean {
  if (tx < 1 || ty < 1 || tx >= world.width - 1 || ty >= world.height - 1) return false;
  const idx = ty * world.width + tx;
  if (world.elevation[idx] !== 0 || world.ramp[idx] !== 0) return false;
  if (world.tiles[idx] === TILE_WATER) return false;
  if (ground[idx] !== 1) return false;
  const v = rampDirVector(dir);
  const upX = tx + v.x;
  const upY = ty + v.y;
  const upIdx = upY * world.width + upX;
  if (!plateau.has(upIdx) || world.ramp[upIdx] !== 0) return false;
  const downX = tx - v.x;
  const downY = ty - v.y;
  if (downX < 0 || downY < 0 || downX >= world.width || downY >= world.height) return false;
  const downIdx = downY * world.width + downX;
  if (world.elevation[downIdx] !== 0 || world.ramp[downIdx] !== 0) return false;
  if (world.tiles[downIdx] === TILE_WATER) return false;
  return true;
}

/** Wszystkie możliwe rampy szerokości 2 dla płaskowyżu (stała kolejność = determinizm). */
function rampCandidates(world: World, plateau: Plateau, ground: Uint8Array): RampCandidate[] {
  const tiles = new Set(plateau.tiles);
  const out: RampCandidate[] = [];
  const seen = new Set<string>();
  for (const dir of [1, 2, 3, 4] as RampDir[]) {
    const v = rampDirVector(dir);
    // Kierunek prostopadły do osi rampy — wzdłuż niego leży druga połowa.
    const px = v.y;
    const py = -v.x;
    for (const upIdx of plateau.tiles) {
      const upX = upIdx % world.width;
      const upY = (upIdx - upX) / world.width;
      const baseX = upX - v.x;
      const baseY = upY - v.y;
      for (const side of [1, -1]) {
        const otherX = baseX + px * side;
        const otherY = baseY + py * side;
        if (!rampTileOk(world, baseX, baseY, dir, tiles, ground)) continue;
        if (!rampTileOk(world, otherX, otherY, dir, tiles, ground)) continue;
        const a = baseY * world.width + baseX;
        const b = otherY * world.width + otherX;
        const key = `${dir}:${Math.min(a, b)}:${Math.max(a, b)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ dir, tiles: [a, b] });
      }
    }
  }
  return out;
}

/** Wpisuje rampę i czyści korytarz 2×3 (kafle rampy + ich sąsiedzi dolni i górni). */
function applyRamp(world: World, candidate: RampCandidate): void {
  const v = rampDirVector(candidate.dir);
  for (const idx of candidate.tiles) {
    const tx = idx % world.width;
    const ty = (idx - tx) / world.width;
    world.ramp[idx] = candidate.dir;
    clearObstacle(world, idx);
    clearObstacle(world, (ty + v.y) * world.width + (tx + v.x));
    clearObstacle(world, (ty - v.y) * world.width + (tx - v.x));
  }
}

/**
 * Rampy: 1–2 na płaskowyż, szerokość 2, podnóże po stronie osiągalnej ze startu.
 * Płaskowyż bez żadnej rampy jest obniżany (kontrakt: każdy płaskowyż osiągalny).
 */
function carveRamps(world: World, plateaus: Plateau[], start: TilePos): Plateau[] {
  const cfg = MAPGEN.plateaus;
  const kept: Plateau[] = [];
  for (const plateau of plateaus) {
    const ground = groundReachable(world, start);
    let candidates = rampCandidates(world, plateau, ground);
    if (candidates.length === 0) {
      lowerPlateau(world, plateau);
      continue;
    }
    const wanted = rngInt(world.rng, cfg.rampsMin, cfg.rampsMax);
    for (let i = 0; i < wanted && candidates.length > 0; i++) {
      const pick = candidates[rngInt(world.rng, 0, candidates.length - 1)];
      if (!pick) break;
      applyRamp(world, pick);
      plateau.rampTiles.push(...pick.tiles);
      const placed = pick.tiles.map((idx) => ({
        x: idx % world.width,
        y: (idx - (idx % world.width)) / world.width,
      }));
      // Kolejna rampa musi leżeć w innym miejscu krawędzi (odstęp Czebyszewa).
      candidates = candidates.filter((c) =>
        c.tiles.every((idx) => {
          if (world.ramp[idx] !== 0 || world.elevation[idx] !== 0) return false;
          const x = idx % world.width;
          const y = (idx - x) / world.width;
          return placed.every(
            (p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) >= cfg.rampMinGap,
          );
        }),
      );
    }
    kept.push(plateau);
  }
  return kept;
}

/** Głazy: 20–40 sztuk na suchym terenie poziomu 0/1, poza startem i korytarzami ramp. */
function scatterRocks(world: World, start: TilePos): void {
  const cfg = MAPGEN.rocks;
  const count = rngInt(world.rng, cfg.countMin, cfg.countMax);
  const startX = start.x + 0.5;
  const startY = start.y + 0.5;
  const safe2 = cfg.startSafeRadius * cfg.startSafeRadius;
  let placed = 0;
  let attempts = 0;
  const budget = count * cfg.attemptsPerRock;
  while (placed < count && attempts < budget) {
    attempts++;
    const x = rngInt(world.rng, 1, world.width - 2);
    const y = rngInt(world.rng, 1, world.height - 2);
    const idx = y * world.width + x;
    // Zajęte (woda, drzewo, inny głaz), rampa albo jej korytarz — pomijamy.
    if (world.blocked[idx] === 1 || world.tiles[idx] === TILE_WATER) continue;
    if (world.ramp[idx] !== 0) continue;
    let nearRamp = false;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      if (world.ramp[ny * world.width + nx] !== 0) nearRamp = true;
    }
    if (nearRamp) continue;
    const dx = x + 0.5 - startX;
    const dy = y + 0.5 - startY;
    if (dx * dx + dy * dy <= safe2) continue;
    const size = rngNext(world.rng) < cfg.bigChance ? 1 : 0;
    const rock: Rock = { id: world.nextId++, x, y, size: size as 0 | 1 };
    world.rocks.push(rock);
    world.blocked[idx] = 1;
    placed++;
  }
}

/** Kafle osiągalne ze startu z pełną regułą przejścia (`canCross`, 4-sąsiedztwo). */
function reachableTiles(world: World, start: TilePos): Uint8Array {
  const seen = new Uint8Array(world.width * world.height);
  const first = start.y * world.width + start.x;
  const queue: number[] = [first];
  seen[first] = 1;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head] ?? 0;
    const x = idx % world.width;
    const y = (idx - x) / world.width;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      const nIdx = ny * world.width + nx;
      if (seen[nIdx] === 1) continue;
      if (!canCross(world, x, y, nx, ny)) continue;
      seen[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  return seen;
}

/**
 * Znajduje pierwszą przeszkodę (drzewo/głaz) na najkrótszej drodze od terenu
 * osiągalnego do jednego z kafli `targets`. `-1`, gdy takiej drogi nie ma.
 */
function findDoor(world: World, reach: Uint8Array, targets: Set<number>): number {
  const parent = new Int32Array(world.width * world.height).fill(-2);
  const queue: number[] = [];
  for (let i = 0; i < reach.length; i++) {
    if (reach[i] === 1) {
      parent[i] = -1;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head] ?? 0;
    const x = idx % world.width;
    const y = (idx - x) / world.width;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      const nIdx = ny * world.width + nx;
      if (parent[nIdx] !== -2) continue;
      if (world.tiles[nIdx] === TILE_WATER) continue;
      // Przez drzewa/głazy wolno „przejść" — właśnie je rozważamy do usunięcia.
      if (!canCrossTerrain(world, x, y, nx, ny)) continue;
      parent[nIdx] = idx;
      if (targets.has(nIdx)) {
        // Cofamy się do terenu osiągalnego i usuwamy pierwszą przeszkodę na drodze.
        const path: number[] = [];
        let cur = nIdx;
        while (cur >= 0 && reach[cur] !== 1) {
          path.push(cur);
          cur = parent[cur] ?? -1;
        }
        path.reverse();
        for (const step of path) {
          if (world.blocked[step] === 1) return step;
        }
        return -1;
      }
      queue.push(nIdx);
    }
  }
  return -1;
}

/**
 * Gwarancja z kontraktu: każdy niezablokowany kafel płaskowyżu jest osiągalny ze startu.
 * Drzewa i głazy mogą przypadkiem odciąć fragment wierzchowiny — wtedy generator
 * „otwiera drzwi", usuwając pojedynczą przeszkodę na drodze.
 */
function ensurePlateausReachable(world: World, plateaus: readonly Plateau[], start: TilePos): void {
  const plateauTilesAll = new Set<number>();
  for (const p of plateaus) for (const idx of p.tiles) plateauTilesAll.add(idx);
  if (plateauTilesAll.size === 0) return;
  for (let door = 0; door < MAPGEN.plateaus.reachabilityDoors; door++) {
    const reach = reachableTiles(world, start);
    const targets = new Set<number>();
    for (const idx of plateauTilesAll) {
      if (world.blocked[idx] === 0 && reach[idx] !== 1) targets.add(idx);
    }
    if (targets.size === 0) return;
    const doorIdx = findDoor(world, reach, targets);
    if (doorIdx < 0) return;
    clearObstacle(world, doorIdx);
  }
}

/** Pełny świat Fazy 1: teren, woda przy brzegu, skupiska drzew, polany, robotnik. */
export function generateWorld(seed: number): World {
  const world = createEmptyWorld(seed, MAP_W, MAP_H);
  paintGrass(world);
  paintDirt(world);
  paintWater(world);
  const clearings = pickClearings(world);
  const startClearing = clearings[0] ?? { x: world.width / 2, y: world.height / 2, r: 5 };
  const start = pickStartTile(world, startClearing);
  plantTrees(world, clearings, start);
  spawnWorker(world, start);
  // Wywyższenia dopisane PO istniejących krokach — charakter mapy zostaje bez zmian.
  const plateaus = carveRamps(world, raisePlateaus(world, start), start);
  scatterRocks(world, start);
  ensurePlateausReachable(world, plateaus, start);
  return world;
}

// ——— Klonowanie ———

export function cloneWorld(world: World): World {
  return {
    seed: world.seed,
    tick: world.tick,
    width: world.width,
    height: world.height,
    tiles: world.tiles.slice(),
    blocked: world.blocked.slice(),
    elevation: world.elevation.slice(),
    ramp: world.ramp.slice(),
    trees: world.trees.map((t) => ({ id: t.id, x: t.x, y: t.y, wood: t.wood, state: t.state })),
    rocks: world.rocks.map((r) => ({ id: r.id, x: r.x, y: r.y, size: r.size })),
    units: world.units.map((u) => ({
      id: u.id,
      kind: u.kind,
      pos: { x: u.pos.x, y: u.pos.y },
      vel: { x: u.vel.x, y: u.vel.y },
      facing: u.facing,
      moving: u.moving,
      hp: u.hp,
      maxHp: u.maxHp,
      speed: u.speed,
    })),
    wood: world.wood,
    gold: world.gold,
    nextId: world.nextId,
    rng: { state: world.rng.state },
  };
}

// ——— Hash stanu (FNV-1a 32-bit) ———

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Pozycje zaokrąglane do 1e-6 i zapisywane jako liczby całkowite. */
const POS_SCALE = 1e6;

/** Dokłada 4 bajty liczby do hasha FNV-1a. */
function fnv(hash: number, value: number): number {
  let h = hash;
  let v = value >>> 0;
  for (let i = 0; i < 4; i++) {
    h ^= v & 0xff;
    h = Math.imul(h, FNV_PRIME) >>> 0;
    v >>>= 8;
  }
  return h >>> 0;
}

function fnvFloat(hash: number, value: number): number {
  return fnv(hash, Math.round(value * POS_SCALE));
}

const TREE_STATE_CODE: Record<Tree['state'], number> = { full: 0, chopped: 1, stump: 2 };
const UNIT_KIND_CODE: Record<Unit['kind'], number> = { worker: 0, vampire: 1 };

/**
 * Kanoniczny hash stanu świata (FNV-1a 32-bit, 8 znaków hex).
 * Pola pisane jawnie i w stałej kolejności — bez `JSON.stringify`, bo kolejność
 * kluczy obiektu nie jest częścią kontraktu.
 */
export function hashWorld(world: World): string {
  let h = FNV_OFFSET;
  h = fnv(h, world.tick);
  h = fnv(h, world.width);
  h = fnv(h, world.height);
  h = fnvFloat(h, world.wood);
  h = fnvFloat(h, world.gold);
  h = fnv(h, world.nextId);
  h = fnv(h, world.rng.state);
  for (let i = 0; i < world.tiles.length; i++) h = fnv(h, world.tiles[i] ?? 0);
  for (let i = 0; i < world.blocked.length; i++) h = fnv(h, world.blocked[i] ?? 0);
  for (let i = 0; i < world.elevation.length; i++) h = fnv(h, world.elevation[i] ?? 0);
  for (let i = 0; i < world.ramp.length; i++) h = fnv(h, world.ramp[i] ?? 0);
  for (const tree of world.trees) {
    h = fnv(h, tree.id);
    h = fnv(h, tree.x);
    h = fnv(h, tree.y);
    h = fnvFloat(h, tree.wood);
    h = fnv(h, TREE_STATE_CODE[tree.state]);
  }
  for (const rock of world.rocks) {
    h = fnv(h, rock.id);
    h = fnv(h, rock.x);
    h = fnv(h, rock.y);
    h = fnv(h, rock.size);
  }
  for (const unit of world.units) {
    h = fnv(h, unit.id);
    h = fnv(h, UNIT_KIND_CODE[unit.kind]);
    h = fnvFloat(h, unit.pos.x);
    h = fnvFloat(h, unit.pos.y);
    h = fnvFloat(h, unit.vel.x);
    h = fnvFloat(h, unit.vel.y);
    h = fnv(h, unit.facing);
    h = fnv(h, unit.moving ? 1 : 0);
    h = fnvFloat(h, unit.hp);
    h = fnvFloat(h, unit.maxHp);
    h = fnvFloat(h, unit.speed);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
