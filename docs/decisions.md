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
