# Architecture contract (Faza 0–1)

Ten dokument jest wiążący dla wszystkich modułów. Zmiany kontraktu → wpis w `docs/decisions.md`.

## Stałe
- `TICK_RATE = 20` (Hz), `TICK_MS = 50`. Wszystkie stałe balansu/rozmiarów w `src/sim/balance.ts`.
- Mapa `MAP_W = MAP_H = 64` kafli. Kafel iso: `TILE_W = 32`, `TILE_H = 16` (px, 1×).
- Jednostki pozycji w symulacji: **kafle (float)**. `pos {x, y}` w przestrzeni siatki (nie ekranowej).
- Prędkość w `balance.ts`: `WORKER_SPEED_TILES_PER_S = 4` (mnożnik z planu 1.0 = 4 kafle/s; wampir 1.15 → 4.6).

## Przestrzeń iso (render/input, NIE sim)
```
screenX = (gx - gy) * TILE_W / 2
screenY = (gx + gy) * TILE_H / 2
gx = (screenX / (TILE_W/2) + screenY / (TILE_H/2)) / 2
gy = (screenY / (TILE_H/2) - screenX / (TILE_W/2)) / 2
```
`src/render/iso.ts` eksportuje `gridToScreen`, `screenToGrid`, `depthFor(gx, gy)`.

## Kierunki
`Dir8`: `0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW` — **w przestrzeni siatki** (N = -y, E = +x).
`DIR_VECTORS: Record<Dir8, {x,y}>` (znormalizowane, przekątne 0.7071). Sprite'y: rysowane 4 (NE, SE, SW, NW); pozostałe 4 przez mapowanie + flipX w `src/render/facing.ts`.

## src/sim — API publiczne
```ts
// types.ts
type EntityId = number;
interface Vec2 { x: number; y: number }
type TileKind = 0 /*grass0*/ | 1 /*grass1*/ | 2 /*grass2*/ | 3 /*dirt*/ | 4 /*water*/;
interface Tree { id: EntityId; x: number; y: number; wood: number; state: 'full' | 'chopped' | 'stump' }
interface Unit { id: EntityId; kind: 'worker' | 'vampire'; pos: Vec2; vel: Vec2; facing: Dir8; moving: boolean; hp: number; maxHp: number; speed: number }
interface World {
  seed: number; tick: number; width: number; height: number;
  tiles: Uint8Array;            // TileKind, index = y*width + x
  blocked: Uint8Array;          // 1 = statycznie zablokowane (drzewo, woda)
  trees: Tree[];                // indeks pomocniczy: treeAt(world, x, y)
  units: Unit[];
  wood: number; gold: number;
  nextId: EntityId;
  rng: { state: number };       // stan mulberry32
}
// world.ts
function generateWorld(seed: number): World   // trawa (warianty), skupiska drzew, kilka polan, robotnik w polanie startowej
function hashWorld(world: World): string       // FNV-1a 32-bit hex nad kanoniczną serializacją (tiles, trees, units z pozycjami zaokrąglonymi do 1e-6, zasoby, tick, rng.state)
function cloneWorld(world: World): World
// commands.ts
type Command =
  | { type: 'move'; unitId: EntityId; dir: Dir8 | null }   // null = stop
  | { type: 'chop'; unitId: EntityId; treeId: EntityId }   // Faza 2 (może być no-op w Fazie 1)
  | { type: 'build'; unitId: EntityId; building: string; x: number; y: number }
  | { type: 'cancel'; unitId: EntityId };
// tick.ts
function step(world: World, commands: Command[]): World   // mutuje i zwraca ten sam obiekt; tick++
// rng.ts
function mulberry32(seed: number): () => number   // deterministyczny
function rngNext(state: {state:number}): number    // krok na stanie w World
```
- `src/sim` nie importuje Phasera, DOM ani `assets/`. Zero `Math.random`, `Date.now`, `performance.now`.
- Ruch: `pos += DIR_VECTORS[dir] * speed / TICK_RATE`. Kolizja jednostka (okrąg r = `UNIT_RADIUS` z balance) vs zablokowane kafle; ślizganie po osiach (najpierw x, potem y). Ograniczenie do granic mapy.
- Test determinizmu: `tests/determinism.test.ts` — 1000 ticków, ten sam seed + te same komendy ⇒ identyczny `hashWorld`; inny seed ⇒ inny hash.

## assets — pipeline
- `assets/src/palette.ts`: `PALETTE` — max 32 kolorów z nazwami (Endesga 32).
- `assets/src/sprite.ts`: `sprite({ palette: Record<char, string|null>, frames: string[][], anchor?: {x,y} })` → `SpriteDef`. Wszystkie kolory muszą pochodzić z `PALETTE` (walidacja w build).
- `assets/src/index.ts`: `export const SPRITES: Record<string, SpriteDef>` — klucz = nazwa klatki bazowa; klatki wieloklatkowe dostają sufiks `_0`, `_1`, …
- `scripts/build-atlas.ts` → `assets/build/atlas.png` + `assets/build/atlas.json` (Phaser "JSON Hash"), padding 1 px. `scripts/preview-sprites.ts` → `assets/build/preview.html` (siatka ×4, podpisy).
- Vite: `publicDir: 'assets/build'` → w grze atlas dostępny pod `atlas.png` / `atlas.json` (ścieżki względne, `base: './'`).
- Nazwy klatek Fazy 1:
  - `tile_grass0`, `tile_grass1`, `tile_grass2`, `tile_dirt`, `tile_water` — 32×16 diament
  - `tree_full`, `tree_chopped`, `tree_stump` — anchor u podstawy (środek diamentu kafla)
  - `worker_idle_{ne|se|sw|nw}_{0|1}`, `worker_walk_{ne|se|sw|nw}_{0..3}` — ~16×24, anchor stopy
  - `shadow` — elipsa z alfą
  - `dot` — 1×1 biały (do debugów/HUD)

## render / input
- `src/main.ts` — konfiguracja Phasera: `type: AUTO, pixelArt: true, roundPixels: true, scale: { mode: RESIZE, autoCenter: CENTER_BOTH }`, zoom kamery 2–3.
- `src/render/GameScene.ts` — akumulator czasu → stały `step()` co 50 ms; render interpoluje między `prevPos` a `pos` (render trzyma własną mapę poprzednich pozycji).
- `src/input/joystick.ts` — pływający joystick na lewej połowie ekranu, zwraca wektor ekranowy → `screenToGrid` → snap do `Dir8` → `MoveCommand` co tick (i `dir: null` po puszczeniu).
- HUD: FPS + tick w rogu (Phaser Text lub cienki DOM overlay).
