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

## Wywyższenia (elewacja) — rozszerzenie kontraktu po playteście Fazy 1

Poziomy terenu: `0` (ziemia) i `1` (płaskowyż). Przejście między poziomami tylko przez **rampy** o szerokości 2 kafli.

### Stałe (`balance.ts`)
- `ELEV_LEVELS = 2`, `ELEV_PX = 10` — o ile pikseli (1×) wyżej rysowany jest poziom 1 (wysokość klifu).
- `mapgen.plateaus`: liczba 2–4, promień 5–9, min. dystans od startu 12 kafli, rampy: min. 1 na płaskowyż, szerokość 2.
- `mapgen.rocks`: 20–40 głazów poza płaskowyżami/polaną startową (blokują jak drzewa).

### Sim — nowe pola `World`
```ts
elevation: Uint8Array;   // 0|1 per kafel, index = y*width + x
ramp: Uint8Array;        // 0 = brak; 1..4 = kierunek POD GÓRĘ w przestrzeni siatki: 1=N(-y), 2=E(+x), 3=S(+y), 4=W(-x)
rocks: Rock[];           // { id, x, y, size: 0|1 } — statyczne blokery (w `blocked`)
```
Kafel rampy ma `elevation` = poziom **dolny** (podstawa); jego sąsiad w kierunku `ramp` ma poziom wyższy o 1.
Rampa 2-kaflowa = dwa sąsiednie kafle rampy o tym samym kierunku, obok siebie prostopadle do kierunku.

### Reguła przejścia `canCross(world, ax, ay, bx, by): boolean` (sąsiedzi 4-kierunkowi; eksport z `src/sim/systems/terrain.ts`)
- oba kafle niezablokowane (`blocked`), inaczej `false`;
- bez ramp: `elev[a] == elev[b]`;
- `a` jest rampą (`rA`): B w kierunku `rA` → `elev[b] == elev[a] + 1`; B w kierunku przeciwnym → `elev[b] == elev[a]` i `ramp[b] == 0`; B prostopadle → `elev[b] == elev[a]` i (`ramp[b] == 0` lub `ramp[b] == rA`);
- symetrycznie, gdy rampą jest `b` (`canCross` jest symetryczne: `canCross(a,b) == canCross(b,a)`);
- przekątne: dozwolone tylko, gdy obie ścieżki „po L" (przez dwa sąsiednie kafle ortogonalne) są przejezdne.
Ruch (`movement.ts`): po przesunięciu osiowym kandydat jest odrzucany, jeśli kafel pod środkiem zmienił się na nieprzejezdny wg `canCross`, albo jeśli okrąg jednostki zachodzi na kafel `X ≠ T'`, dla którego `canCross(T', X)` jest fałszywe (przekątne wg reguły L). Klify działają jak ściany, rampy jak korytarze.

### `elevationAt(world, gx, gy): number` (float, eksport z terrain.ts)
Dla zwykłego kafla: `elevation`. Dla rampy: `elevation + f`, gdzie `f ∈ [0,1]` to postęp środka jednostki wzdłuż osi rampy w stronę góry (np. rampa `N`: `f = 1 - frac(gy)`; `E`: `f = frac(gx)`; `S`: `f = frac(gy)`; `W`: `f = 1 - frac(gx)`). Render używa `screenY -= elevationAt(...) * ELEV_PX` dla jednostek i drzew.

### Render
- Kolejność malowania kafli w RenderTexture: rosnące `gx + gy`, w rzędzie rosnące `gx`. Dla kafla: najpierw ściany klifu (gdy sąsiad S `(x, y+1)` lub E `(x+1, y)` jest niżej i nie jest rampą prowadzącą na ten kafel), potem wierzch przesunięty o `-elev * ELEV_PX`, na końcu rąbki górnych krawędzi. Ściany leżą wewnątrz nieprzesuniętego diamentu kafla, więc nie kolidują z bliższymi kaflami.
- Wierzch kafla na poziomie ≥ 1 to jaśniejszy wariant trawy (`tile_grass_hi{0,1,2}` zamiast `tile_grass{0,1,2}`; `tile_dirt`/`tile_water` bez zmian) — płaskowyż ma się czytać jako „wyspa" także tam, gdzie krawędź jest poza kadrem.
- Rąbek górnej krawędzi: `ledge_n` (sąsiad N `(x, y-1)` niżej i nie jest rampą o kierunku S) i `ledge_w` (sąsiad W `(x-1, y)` niżej i nie jest rampą o kierunku E), malowane PO wierzchu, z tym samym przesunięciem `-elev * ELEV_PX`. Ściany N/W nie istnieją, więc to jedyna sylwetka płaskowyżu od strony górnej-ekranowej.
- Rampa: sprite `ramp_{n|e|s|w}` rysowany w miejscu kafla (zawiera własne ścianki boczne), przesunięty o `-elev * ELEV_PX`. Rampy `e`/`s` mają dodatkowo podjazd („apron") wychodzący `RAMP_APRON` px ponad diament kafla — bez niego widać z nich tylko 6-px pasek.
- Klatki atlasu: `cliff_s`, `cliff_e` (ściany 16×(8+ELEV_PX) — ściana S to lewa dolna krawędź diamentu, E to prawa dolna), `cliff_corner` (opcjonalnie, styk S/E), `ledge_n`, `ledge_w` (rąbki 16×9, anchor `{0, 8/9}` / `{1, 8/9}` — górna połowa diamentu), `ramp_n`, `ramp_e`, `ramp_s`, `ramp_w` (32×(16+ELEV_PX), anchor tak, by dolny diament pokrywał kafel), `tile_grass_hi{0,1,2}` (32×16, jak zwykłe kafle), `rock_small` (~12×10), `rock_big` (~20×16), anchor stopa (środek kafla).

## Faza 2 — ekonomia i budowanie (kontrakt)

### Sim — nowe pola i typy
```ts
type BuildingKind = 'wall' | 'tower' | 'sawmill' | 'generator';
interface Building { id: EntityId; kind: BuildingKind; x: number; y: number; w: number; h: number;
  hp: number; maxHp: number; level: number; buildTicksLeft: number /* 0 = gotowy */ }
type UnitAction = null | { type: 'chop'; treeId: EntityId; ticksLeft: number };
// Unit: + action: UnitAction
// World: + buildings: Building[]; woodFrac: number (ułamek drewna z tartaków, akumulowany)
// Tree: + chops: number (ile razy nadrąbane)
```
Komendy: `chop {unitId, treeId}`, `build {unitId, building: BuildingKind, x, y}`, `cancel {unitId}` (już w typie `Command`).

### Reguły
- **Rąbanie**: `chop` jest przyjęte, gdy dystans środka jednostki do środka kafla drzewa `≤ worker.interactRange` i drzewo nie jest pieńkiem. Ustawia `unit.action = {chop, ticksLeft: worker.chopTicks}` i zatrzymuje jednostkę (`vel = 0, moving = false`). Komenda `move` z `dir != null` lub `cancel` przerywa akcję. Gdy `ticksLeft` dojdzie do 0: `wood += worker.chopWood`, `tree.chops++`, `tree.wood -= chopWood`; `chops == 1` → `state = 'chopped'`; `chops >= trees.chopsToStump` → `state = 'stump'`, kafel przestaje blokować (`blocked = 0`). Jednostka obraca się (`facing`) w stronę drzewa przy starcie rąbania.
- **Budowa**: `build` jest przyjęte, gdy: kind ∈ {wall, sawmill} (tower/generator → Faza 4, odrzucane), `wood >= koszt`, cały footprint (w×h od (x,y)) leży w mapie, nie jest zablokowany, nie ma rampy, ma jedną wspólną elewację, nie zachodzi na okrąg żadnej jednostki, oraz odległość środka jednostki do najbliższego kafla footprintu `≤ BALANCE.build.rangeTiles` (= 5). Skutek: `wood -= koszt`, nowy `Building` z `buildTicksLeft = buildTicks`, `hp = maxHp` (v1: budynek w budowie ma pełne HP, ale nie działa), footprint → `blocked = 1`.
- **Konstrukcja**: co tick `buildTicksLeft--` (bez robotnika). Tartak działa, gdy `buildTicksLeft == 0`.
- **Tartak**: co tick, jeśli w promieniu `sawmill.treeRadiusTiles` od środka footprintu jest ≥ 1 drzewo `full|chopped`: `woodFrac += woodPerSecond / TICK_RATE`; gdy `woodFrac >= 1` → przenieś część całkowitą do `wood`.
- **Kolejność w `step`**: komendy (move/chop/build/cancel) → ruch → akcje jednostek (chop) → konstrukcja → ekonomia (tartak) → `tick++`.
- `hashWorld` obejmuje `buildings`, `woodFrac`, `unit.action`, `tree.chops`.
- Helpery (czyste, eksport z `src/sim`): `nearestChoppableTree(world, pos, range)`, `canPlaceBuilding(world, unitId, kind, x, y): { ok: boolean; reason?: string }`, `buildingAt(world, x, y)`, `wallMask(world, x, y): number` (bit 1=N, 2=E, 4=S, 8=W: sąsiedni kafel to mur), `footprintOf(kind)`.

### Assets — nowe klatki (Faza 2)

Wszystkie pozycje liczone są z `gridToScreen` (`src/render/iso.ts`) i `pivot` z atlasu, dokładnie
tak jak w `src/render/terrainPaint.ts`: `left = punkt.x − pivot.x · w`, `top = punkt.y − pivot.y · h`
(oba przez `Math.round`). Na wywyższeniu dochodzi `top −= elevationAt(...) · ELEV_PX`, jak dla propów.

| klatka | rozmiar | pivot | punkt odniesienia | lewy-górny róg |
| --- | --- | --- | --- | --- |
| `wall_0` … `wall_15`, `wall_build` | 32×32 | `{0.5, 0.75}` | środek kafla `gridToScreen(x+0.5, y+0.5)` | `left = X − 16`, `top = Y − 24` |
| `sawmill`, `generator` (2×2) | 64×48 | `{0.5, 1}` | dolny narożnik footprintu `gridToScreen(x+2, y+2)` | `left = X − 32`, `top = Y − 48` |
| `tower_1` (1×1) | 32×48 | `{0.5, 1}` | dolny narożnik footprintu `gridToScreen(x+1, y+1)` | `left = X − 16`, `top = Y − 48` |
| `worker_chop_{ne,se,sw,nw}_{0,1,2}` | 16×24 | `{0.5, 1}` | pozycja jednostki | `left = X − 8`, `top = Y − 24` |
| `fx_chip` | 3×3 | `{0.5, 0.5}` | punkt cząstki | `left = X − 1.5`, `top = Y − 1.5` |
| `fx_hit` | 8×8 | `{0.5, 0.5}` | punkt trafienia | `left = X − 4`, `top = Y − 4` |

- **Mur `wall_{maska}`** — indeks = maska `N|E|S|W` = `1|2|4|8` z `wallMask()`. Płótno 32×32:
  dolne 16 wierszy to dokładnie bounding box diamentu kafla, górne 16 to zapas na wysokość.
  Pivot `{0.5, 0.75}` = ŚRODEK KAFLA (24. wiersz sprite'a), więc mur pozycjonuje się tak samo
  jak kafel terenu, tylko z innym pivotem. Geometria: słupek 10 px szerokości i 18 px wysokości
  w środku kafla + dla każdego bitu segment 6 px szerokości i 14 px wysokości od środka kafla
  do środka odpowiedniej krawędzi (N = górna-prawa, E = dolna-prawa, S = dolna-lewa, W = górna-lewa).
  Segment kończy się dokładnie na krawędzi kafla i **nie ma na niej konturu**, więc sąsiednie mury
  sklejają się w ciągłą ścianę bez szczeliny i bez ciemnej kreski (test: `tests/assets/walls.test.ts`).
  Kolejność rysowania murów: rosnące `x + y` (nieodzowne — bliższy kafel zamalowuje przekrój dalszego).
- **`wall_build`** — ten sam słupek jako drewniane rusztowanie (pomost + deski + prześwity),
  bez segmentów. Render używa go zamiast `wall_{maska}` dla `buildTicksLeft > 0`, z alfą i paskiem
  postępu; auto-tiling włącza się dopiero po ukończeniu budowy.
- **Budynki** — bryły iso z kotwicą w dolnym narożniku footprintu (patrz tabela). Bryła jest
  wpuszczona w footprint (nie dotyka jego krawędzi co do piksela), dzięki czemu 2×2 nie zachodzi
  na sąsiednie kafle. `depth = depthFor(x + w, y + h)` — ten sam punkt, co kotwica.
- **HUD** (atlas `hud.png`, rasteryzacja 2×, pivot każdej klatki `{0.5, 0.5}`):
  `icon_wood`, `icon_axe`, `icon_build`, `icon_wall`, `icon_sawmill`, `icon_tower`, `icon_generator`,
  `icon_cancel` — 64×64 px w atlasie (32×32 css), `btn_ring` — 192×192 (96×96 css),
  `radial_slot` — 128×128 (64×64 css). Render skaluje je o 0.5 i rysuje kamerą HUD (bez zoomu).
  Źródła: `assets/src/hud/*.svg`, build: `scripts/build-hud.ts` (odpalany przez `npm run atlas`).

### Input / render
- **Przycisk akcji** (prawa dolna ćwiartka, duży okrąg ~72 px ekranowych): kontekst: w trybie budowy → „postaw"; w zasięgu drzewa (`nearestChoppableTree`) → „rąb" (ikona siekiery); inaczej nieaktywny (przyciemniony).
- **Przycisk „Buduj"** (nad przyciskiem akcji) otwiera **menu radialne** (mur, tartak; wieża i generator widoczne, ale wyszarzone z podpisem „Faza 4"). Wybór → tryb budowy z ghostem.
- **Tryb budowy**: ghost budynku na kaflu przed robotnikiem (kafel w kierunku `facing`, dla 2×2 lewy-górny = ten kafel), zielony (ok) / czerwony (`canPlaceBuilding.reason`). Przycisk akcji = `build`. Przycisk „X" zamyka tryb. **Drag-to-build (mur)**: przeciąganie palcem po mapie (poza joystickiem, poza przyciskami) przesuwa kursor po kaflach; dla każdego nowego kafla na ścieżce (Bresenham między kolejnymi kaflami) wysyłana jest komenda `build wall` jeśli `canPlaceBuilding.ok`; kafle poza zasięgiem / bez drewna → czerwony ghost, brak komendy. Ghost podąża za palcem podczas przeciągania. Kamera nie przewija się podczas drag-to-build.
- **HUD**: lewy górny: drewno (ikona + liczba), timer rundy (mm:ss, Faza 3 użyje), FPS/tick w debug (parametr `?debug=1`).
- **Render budynków**: `Image`/`Sprite` z depth `depthFor(x + w, y + h)` (dolny narożnik footprintu), elewacja jak propy; w budowie: alpha 0.55 + pasek postępu (Graphics) nad budynkiem. Mury: klatka `wall_{mask}` odświeżana, gdy zmieni się `wallMask` dla kafla lub sąsiadów.
- Drzewo `chopped`/`stump` zmienia klatkę; przy stump kafel przestaje blokować także w renderze (nic do zrobienia poza klatką).
- Rąbanie: animacja `worker_chop_{dir}` w pętli, gdy `unit.action?.type === 'chop'`; wióry `fx_chip` (3–4 cząstki, 300 ms) co uderzenie (co `chopTicks/3`).
