# Decyzje

Wpis: data, decyzja, powód. Każda zmiana kontraktu z `docs/architecture.md` musi tu trafić.

## 2026-09-13 — Phaser 3.90 zamiast 4.x
Plan (`PLAN.md` §1) wymaga Phasera 3. Trzymamy `phaser@^3.90.0` — dojrzałe API scen/scale/input,
pełna zgodność z `pixelArt`/`roundPixels` i dokumentacją, do której odnosi się plan. Do Phasera 4
nie migrujemy bez osobnej decyzji.

## 2026-09-13 — `publicDir = assets/build`
Vite kopiuje `publicDir` do `dist/` automatycznie, więc atlas (`atlas.png`, `atlas.json`) i `icon.svg`
trafiają do builda bez ręcznego kopiowania. Dzięki temu `assets/build` może zostać w `.gitignore`,
a jedynym źródłem prawdy są `assets/src` + `scripts/build-atlas.ts`. `npm run build` zawsze
odpala najpierw `npm run atlas`.

## 2026-09-13 — `types: ["vite/client"]` + `/// <reference types="node" />` w skryptach
Główny `tsconfig.json` obejmuje też `scripts/` i `tests/`, które potrzebują typów Node. Zamiast
dopisywać `"node"` do globalnych `types` (co wpuściłoby API Node do kodu gry), każdy plik Node
deklaruje referencję lokalnie.

## 2026-09-13 — `playwright-core` zamiast `@playwright/test`
Do zrzutów ekranu potrzebujemy tylko sterowania przeglądarką, a Chromium jest już w obrazie
(`/opt/pw-browsers`). `playwright-core` nie ma skryptu postinstall pobierającego przeglądarki.
Ścieżkę do binarki wykrywa `scripts/screenshot.ts` (lub `CHROMIUM_PATH`).

## 2026-09-13 — `tsconfig.node.json` obok głównego configu
`tsconfig.json` (include: `src`, `assets/src`, `scripts`, `tests`, `vite.config.ts`) sprawdza całe repo
jednym `tsc --noEmit`. `tsconfig.node.json` zostaje jako config z typami Node dla `vite.config.ts`
(`tsc --noEmit -p tsconfig.node.json`) — nie jest project reference, bo `composite` wyklucza `noEmit`.

## 2026-09-13 — `<link rel="icon" href="./icon.svg">` w `index.html`
Bez tego przeglądarka strzelała po `/favicon.ico` i logowała 404 w konsoli. `icon.svg` i tak jest
w `publicDir`, więc ikona PWA i favicon to ten sam plik.

## 2026-09-13 — Faza 1: drzewa losowane punktowo, nie przez próg gęstości per kafel
Generator (`src/sim/world.ts`) nie przechodzi po kaflach z prawdopodobieństwem zależnym od
odległości od środka skupiska, tylko losuje punkty: kierunek + `d = r * u^0.9` (wykładnik > 0.5
daje gęstość malejącą od środka). Dzięki temu łączna liczba drzew zawsze mieści się w przedziale
z `BALANCE.mapgen.treeClusters` (540–660, kontrakt PLAN: ok. 500–700) niezależnie od tego, ile
miejsca zajęły polany, woda i nakładające się skupiska. Kolejność wywołań `rngNext` pozostaje
stała, więc determinizm jest zachowany.

## 2026-09-13 — Warianty trawy przez kwantyle value-noise
Progi 60/25/15 % liczone są jako kwantyle faktycznego rozkładu szumu (posortowana kopia tablicy
wartości), a nie jako stałe progi na wartości szumu. Wartości value-noise skupiają się wokół 0.5,
więc stałe progi dawałyby wahające się proporcje między seedami. Kwantyle trzymają proporcje
niezależnie od seeda, zachowując plamiastość (sortowanie liczb jest deterministyczne).

## 2026-09-13 — Kanoniczny strumień `hashWorld`
FNV-1a 32-bit (8 znaków hex) po jawnie wypisanych polach w stałej kolejności: `tick`, `width`,
`height`, `wood`, `gold`, `nextId`, `rng.state`, `tiles`, `blocked`, drzewa (id, x, y, wood, state),
jednostki (id, kind, pos, vel, facing, moving, hp, maxHp, speed). Floaty idą przez
`Math.round(v * 1e6)`. Żadnego `JSON.stringify` — kolejność kluczy obiektu nie jest częścią
kontraktu, a hash musi być stabilny. Snapshot `hashWorld(generateWorld(42)) === 'bb6d16d1'`
jest przypięty w `tests/determinism.test.ts`: każda zmiana generatora ma o sobie powiedzieć.

## 2026-09-13 — Faza 1: pipeline grafik (`assets/src` → atlas)

**Paleta.** `assets/src/palette.ts` to pełne Endesga 32 z nazwami; `PALETTE_HEX` (Set) jest
jedynym źródłem prawdy dla walidacji. Walidacja działa dwa razy: w `sprite()` (przy imporcie
modułu, więc zły grid wywala `npm test`/`npm run atlas` od razu) i jeszcze raz w
`validatePalette()` w `scripts/build-atlas.ts`, żeby build nie wypuścił atlasu z kolorem spoza palety.

**Wyjątek od palety: czerń z alfą.** `shadow` używa `#00000059` (~35 % alfy). EDG32 nie ma
kanału alfa, a dodanie „półprzezroczystej czerni” do palety byłoby jej rozszerzeniem o kolor,
którego nie ma. Półprzezroczysta czerń nie wnosi nowego odcienia — tylko przyciemnia tło —
więc dopuszczamy dokładnie wzorzec `#000000rr` i nic więcej (inne kolory z alfą są odrzucane).

**Maska kafla.** Kafel to diament 32×16: piksel należy do kafla, gdy
`|x-15.5|/16 + |y-7.5|/8 <= 1`. Daje to 256 px = dokładnie pole podstawowe siatki iso
(offsety (16, 8) i (−16, 8)), więc kafle pokrywają płaszczyznę bez dziur i bez nakładania.
Pilnuje tego `tests/assets/tiles.test.ts` (dywan 9×9, każdy piksel wnętrza pokryty dokładnie raz).

**Podświetlenie krawędzi: 1 px, nie 2.** Pierwsza wersja miała 2-pikselowy jasny rąbek na
krawędziach NW/NE. Na podglądzie (screenshot `sprites-v5.png`) dywan kafli wyglądał jak pikowana
kołdra — grid dominował nad terenem. 1 px (jasny na górnych krawędziach, ciemny na dolnych)
daje głębię 2.5D i czytelną siatkę pod budowanie, nie krzycząc. PLAN §6 mówi „lekkie”.

**Sprite'y generowane vs rysowane.** Kształty, które muszą być matematycznie dokładne
(maska diamentu, elipsa cienia, korona drzewa), powstają w `scripts/gen-grids.ts`, który
**zapisuje zwykłe literały** do `assets/src/tiles.ts` i `assets/src/nature.ts`. Dzięki temu
w repo dalej są czytelne siatki znaków (PLAN §6 „pixel art jako kod”), a nie kod generujący
piksele w runtimie. Poprawki pikseli tych plików robi się w generatorze i uruchamia go ponownie.
Robotnik (`assets/src/worker.ts`) jest rysowany ręcznie.

**Robotnik: tułów × nogi.** Zamiast 24 osobnych siatek 16×24 trzymamy tułów (16 rzędów) i nogi
(8 rzędów) i składamy je z przesunięciem 0/1 px („bujanie”). Klatki kontaktowe chodu i wydech
bezruchu mają tułów o 1 px niżej — hem tuniki zakrywa wtedy górę nóg, co daje naturalne ściśnięcie.
SW/NW to `flipX` z SE/NE, ale w atlasie istnieją wszystkie cztery nazwy (kontrakt
`docs/architecture.md`), więc `src/render` nie musi wiedzieć o flipie.

**`buildAtlas()` jako funkcja.** `scripts/build-atlas.ts` eksportuje `buildAtlas({ write, outDir, log })`;
`preview-sprites.ts` i testy wołają ją zamiast duplikować pakowanie. `write: false` to dry-run
(liczy layout i JSON, nie dotyka dysku) — na tym opiera się `tests/assets/atlas.test.ts`.

**Rozmiar sprite'ów robotnika: 16×24.** `docs/architecture.md` mówił „~16×24”, PLAN §6 „jednostki
16–24 px wysokości”. Ustalone: płótno 16×24, sylwetka ~11×22 (z siekierą ~13 px szerokości).

## 2026-09-13 — Faza 1: `depthFor` = ekranowy Y punktu

`src/render/iso.ts` definiuje `depthFor(gx, gy) = (gx + gy) * TILE_H / 2`, czyli dokładnie `screenY`
danego punktu siatki (kontrakt mówi „depth = isoY + offset", offset = 0). Dzięki temu depth da się
porównywać z pozycją ekranową bez przeliczeń, a wartości mieszczą się w 0…1024 dla mapy 64×64.
Teren dostaje stałe `depth = -1000` (jest zawsze pod wszystkim), cień jednostki `depth - 0.5`.

## 2026-09-13 — Faza 1: teren jako jedna `RenderTexture` 2048×1024

4096 kafli rysowanych jest RAZ w `create()` (`beginDraw` / `batchDrawFrame` / `endDraw`) do jednej
tekstury i dalej istnieje jako jeden obiekt wyświetlania — zero kosztu sortowania i renderowania
per kafel w klatce (notatki o Phaserze: renderer nie robi cullingu i sortuje wszystkie dzieci).
Tekstura jest zakotwiczona (`setOrigin(0, 0)`) w lewym górnym rogu bounding boxa mapy, który ma
**ujemne x** (skrajnie lewy kafel to (0, MAP_H) → `screenX = -MAP_H * 16 = -1024`); `mapBounds()`
zwraca ten prostokąt i służy zarazem za `camera.setBounds`. Drzewa (609 dla seeda 42) to zwykłe
`Image` z `depth` ustawionym RAZ — nie ruszają się, więc nie ma powodu ich co klatkę sortować.

## 2026-09-13 — Faza 1: HUD na osobnej kamerze zamiast overlaya DOM

PLAN §1 dopuszcza „HUD w Phaserze albo cienki overlay DOM". Wybrany został Phaser + **druga
kamera** (`this.cameras.add()`, zoom 1), bo joystick i tak musi być rysowany w Phaserze
(`Graphics`), a `setScrollFactor(0)` **nie chroni przed zoomem kamery** — przy zoomie 2–3 HUD
i joystick byłyby powiększone razem ze światem. Kamera świata ignoruje obiekty HUD, kamera HUD
ignoruje obiekty świata (`camera.ignore`), więc jedno i drugie renderuje się w swojej skali.
Tekst: monospace 12 px, `setResolution(2)` (ostrość na HiDPI) i półprzezroczysta podkładka —
bez niej biały tekst ginął na jasnej trawie (widać na `phase1-a.png`).

## 2026-09-13 — Faza 1: mapowanie `Dir8` → klatka sprite'a (`src/render/facing.ts`)

Atlas ma cztery narysowane kierunki (`ne`, `se`, `sw`, `nw`) = przekątne siatki, czyli `Dir8`
1/3/5/7. Cztery kierunki osiowe leżą **dokładnie** pomiędzy dwoma narysowanymi (odległość kątowa
jest równa w obie strony), więc zamiast wyjątków przyjęta jest jedna reguła: zaokrąglamy zgodnie
z ruchem wskazówek zegara, `dir + 1` (N → `ne`, E → `se`, S → `sw`, W → `nw`).
`flipX` jest w Fazie 1 **zawsze `false`** — pipeline (`assets/src/worker.ts`) robi flip już przy
budowaniu atlasu, więc wszystkie cztery kierunki istnieją jako osobne klatki i render nie musi nic
odbijać. Pole `flipX` zostaje w typie `Facing` na sprite'y, które w przyszłości będą rysowane
tylko w dwóch kierunkach.

## 2026-09-13 — Faza 1: kierunek z joysticka liczony przez sam obrót układu

`src/input/joystick.ts` przepuszcza **wektor** ekranowy przez `screenToGrid` (bez translacji —
`screenToGrid` jest liniowe, więc dla wektora daje czysty obrót + skalowanie osi), normalizuje go
i dopiero wtedy woła `dirFromVector` z symulacji. Dzięki temu „w prawo" na ekranie zawsze znaczy
ruch w prawo na ekranie (NE w siatce), niezależnie od pozycji kamery. Klawiatura (WASD/strzałki)
idzie tą samą ścieżką, więc palec i klawisz dają identyczne kierunki.

## 2026-09-13 — Faza 1: `window.nightfall` jako uchwyt testowy (również w buildzie produkcyjnym)

`GameScene` wystawia `window.nightfall = { scene, snapshot() }` (tick, pozycja, facing, klucz
i klatka animacji, FPS, zoom). Testy e2e (Playwright) sprawdzają ruch i animację **na buildzie
produkcyjnym**, a stan gry jest w canvasie — bez tego uchwytu trzeba by OCR-ować HUD. Koszt to
jedna referencja na `window`; gdy w Fazie 6 pojawi się tryb „release", można ją schować za flagą.

## 2026-09-13 — Faza 1: znalezione w assetach (do naprawy po stronie `assets/src`, nie w renderze)

Na zrzutach (`phase1-a.png`, `phase1-edge.png`) korony drzew niemal znikają na trawie: `tree_full`
używa `PALETTE.midGreen` (`#3e8948`) jako koloru wypełnienia korony, a `tile_grass0` ma **ten sam**
`#3e8948` jako kolor bazowy kafla. Widać tylko jasny kontur korony. Na `tile_grass1`/`tile_grass2`
(ciemniejsza trawa) i na ziemi drzewa są czytelne. Zgodnie z PLAN §6 („jeśli sprite wygląda źle —
popraw grid, nie dodawaj obejść w kodzie renderu") render **nie** tintuje drzew — poprawka należy
do `assets/src/nature.ts` (ciemniejsza korona / mocniejszy kontur od spodu).

## Faza 1 — korona drzewa z konturem (nadzorca)
Korona `tree_full` miała bazę `midGreen`, identyczną z bazą `tile_grass0` — drzewa znikały na jasnej trawie
(screenshot `phase1-c.png`). Poprawka w generatorze (`scripts/gen-grids.ts`), nie w renderze (PLAN §6):
baza korony `darkGreen`, cień `darkTeal`, światło `midGreen`, plus pełny 1-px kontur `darkBrown`.
Zweryfikowane w grze (`phase1-trees.png`): drzewa czytelne na grass0/1/2 i ziemi.

## 2026-09-14 — Wywyższenia: reguły ramp i klifów (generator + `canCross`)

Kontrakt (`docs/architecture.md`, „Wywyższenia") mówi, jak wygląda przejście między poziomami;
poniżej decyzje, których kontrakt nie przesądza, podjęte przy implementacji `src/sim`.

**`canCross` jako jedna reguła dla wszystkiego.** Kolizje w `movement.ts` nie mają osobnej logiki
klifów: kandydat po przesunięciu osiowym jest odrzucany, gdy `canCross(T, T')` jest fałszywe albo
gdy okrąg jednostki zachodzi na kafel `X ≠ T'` z fałszywym `canCross(T', X)`. Dzięki temu klif,
woda, drzewo i głaz blokują tą samą ścieżką kodu, a ślizganie po osiach (x, potem y) zostaje bez
zmian. Koszt: ≤ 4 zapytania `canCross` na oś (promień 0.3 dotyka najwyżej 4 kafli).
`canCross` jest symetryczne z konstrukcji — regułę rampy sprawdzamy z obu stron (`sideOk`),
więc „w górę / w dół / w bok" wychodzi tak samo niezależnie od kolejności argumentów.
Dwie rampy w jednej linii (jedna za drugą) nie łączą się: przejście „w tył" wymaga `ramp == 0`,
czyli poziomy nie kaskadują — przy `ELEV_LEVELS = 2` nie ma tego potrzeby.

**Generator dopisany PO istniejących krokach.** `paintGrass/Dirt/Water`, polany, drzewa i robotnik
losują dokładnie tak jak wcześniej; płaskowyże, rampy i głazy dokładają swoje wywołania `rngNext`
na końcu. Charakter mapy z Fazy 1 zostaje, zmienia się tylko przypięty hash seeda 42
(`bb6d16d1` → `788ea845`, a po 1000 tickach `a36e95ad` → `0b025216`).

**Płaskowyż = „poszarpane" koło.** Brzeg to promień modulowany dwiema sinusoidami o losowej fazie
(`edgeNoise = 0.14`) — tanio, deterministycznie i bez dodatkowej tablicy szumu. Kandydat jest
odrzucany w całości (a nie przycinany), jeśli którykolwiek jego kafel łamie warunek: margines
6 kafli od krawędzi mapy, ≥ 2 kafle od wody, ≥ 12 kafli od startu, brak kolizji z innym
płaskowyżem (okrąg + `minGap = 3`). Przycinanie dawałoby płaskowyże przyklejone do wody i
odcinające brzegowe kieszenie mapy.

**Rampy wybierane spośród wszystkich kandydatów naraz.** Zamiast „próbuj kierunku N, potem E…"
generator zbiera wszystkie poprawne pary kafli (4 kierunki × krawędź płaskowyżu) i losuje z nich
1–2 rampy, z odstępem Czebyszewa ≥ 3 między rampami tego samego płaskowyżu. Dodatkowy warunek:
podnóże rampy musi leżeć po stronie osiągalnej ze startu „po terenie" (woda blokuje, drzewa nie —
te generator i tak wycina). Płaskowyż bez ani jednej poprawnej rampy jest obniżany do poziomu 0.
Wejście na rampę czyści korytarz 2×3 (kafle rampy + ich sąsiedzi dolni i górni).

**Głazy omijają korytarze ramp.** Kontrakt zabrania głazu na rampie; dokładamy też zakaz na kaflach
ortogonalnie sąsiadujących z rampą, żeby 2-kaflowy podjazd nigdy nie zwężał się do jednego kafla.
Poza tym: 20–40 sztuk, poziom 0 i 1, nie w wodzie, nie na drzewie, ≥ 5 kafli od startu.

**Gwarancja osiągalności zamiast nadziei.** Drzewa (i głazy) mogą przypadkiem odciąć fragment
wierzchowiny. Na końcu generacji BFS z `canCross` sprawdza, czy każdy niezablokowany kafel
płaskowyżu jest osiągalny ze startu; jeśli nie — generator „otwiera drzwi", usuwając pojedynczą
przeszkodę (drzewo/głaz) na najkrótszej drodze i powtarza (limit 64). Alternatywa (obniżanie
odciętych fragmentów) robiła dziury w wierzchowinie. Sprawdzone na 300 seedach: 0 naruszeń
(2–4 płaskowyże, każdy z rampą, 0 nieosiągalnych kafli, głazy 20–40).
