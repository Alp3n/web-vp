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

## 2026-09-14 — Teren wywyższony: geometria klifów, ramp i głazów (`assets/src/terrain.ts`)

**ELEV_PX = 10, zduplikowane świadomie.** `assets/src` i `scripts` nie importują z `src/`, więc
`scripts/gen-grids.ts` i `assets/src/terrain.ts` mają własną stałą `ELEV_PX = 10` z komentarzem,
że musi być równa `ELEV_PX` z `src/sim/balance.ts`. Pilnuje tego `tests/assets/registry.test.ts`
(trzecia kopia) — zmiana wysokości klifu ma paść w testach, a nie cicho rozjechać render.

**Które ściany istnieją.** Kamera patrzy od (−gx, −gy), więc widoczne są tylko ściany **S**
(krawędź dolna-lewa diamentu) i **E** (dolna-prawa). Ściany N/W zasłania sam blok, więc ich nie ma
w atlasie. `cliff_corner` **pominięty**: `cliff_s` zajmuje kolumny 0..15 kafla, `cliff_e` 16..31,
stykają się w dolnym narożniku bez szczeliny (test: każda kolumna ma dokładnie ELEV_PX pikseli).

**Ściany leżą WEWNĄTRZ nieprzesuniętego diamentu.** Sprite ściany rozciąga się od krawędzi wierzchu
podniesionego o ELEV_PX **w dół** do krawędzi na poziomie gruntu — czyli nad dolnymi krawędziami
diamentu, nie pod nimi (`docs/architecture.md`: „Ściany leżą wewnątrz nieprzesuniętego diamentu
kafla"). Gdyby leżały pod nimi, kafel S/E rysowany później (rosnące `gx+gy`) zamalowałby je.

**Światło.** Pada z góry-lewej, tak jak w koronie drzewa. Ściana S (normalna w stronę +gy, ekranowo
dół-lewo) jest **jaśniejsza**, ściana E (normalna +gx, dół-prawo) o jeden odcień **ciemniejsza**:
S = `slate`/`darkSlate`/`navy` + kontur `black`, E = `darkSlate`/`navy` + kontur `black`.
Pierwszy rząd pod wierzchem to trawiasty rąbek (`darkGreen` na S, `darkTeal` na E) — przelewa trawę
płaskowyżu przez krawędź, dzięki czemu klif nie wygląda jak doklejony pasek.

**Głazy z tej samej drabiny wartości co klif.** Pierwsza wersja (`lightGrey`/`grey`/`slate`)
wyglądała na podglądzie jak kłęby waty, nie jak kamień — na zielonej trawie była o dwa stopnie
za jasna. Finalnie `grey` (błysk) / `slate` / `darkSlate` / `navy` + kontur `black` i mech
`darkGreen` u podstawy, czyli dokładnie wartości ścian klifu. Głaz i płaskowyż mają być z tej
samej skały.

**Rampy: `ramp_e` i `ramp_s` są skrajnie skrócone perspektywicznie.** Wierzch rampy to diament
ścięty o ELEV_PX na krawędzi „pod górę". Dla ramp wznoszących się OD kamery (`n`, `w`) rzut wierzchu
ma 416 px, dla wznoszących się W STRONĘ kamery (`e`, `s`) tylko 96 px (diament płaski = 256 px) —
przy ELEV_PX = 10 i połowie wysokości kafla 8 px powierzchnia jest prawie prostopadła do ekranu.
Konsekwencje i rozwiązania:
- wierzch `ramp_e`/`ramp_s` sam **nie pokrywa** własnego kafla, więc `fillBelow()` w generatorze
  domalowuje resztę diamentu jako ścianę. To nigdy nie jest nadmiarowe: leży wewnątrz własnego
  diamentu, więc kafel „pod górę" (rysowany później) i tak to zasłania, a bez tego zostawałaby dziura;
- ścianki ramp są **ziemne** (`leather`/`brown`/`darkBrown` + kontur `black`), a nie skalne jak
  `cliff_*`. Odstępstwo od pierwotnego pomysłu: `ramp_e`/`ramp_s` w szarościach czytały się jako
  „kamienny blok z pomarańczową kreską na górze" (screenshot `terrain-v5`), a nie jako podjazd.
  Brąz spina ściankę z ubitą drogą na wierzchu i odróżnia usypaną rampę od wykutego klifu;
- pochyłość sama w sobie jest w iso niewidoczna, więc wierzch dostaje **2 stopnie**
  (3 pasma wysokości): ciemna podstopnica `darkBrown` + rozświetlony nos `clay` nad nią.
  To jedyny czytelny sygnał „to jest podjazd".

**Bez rąbka na bokach rampy.** Pierwsza wersja rysowała ciemną krawędź na wolnym boku rampy.
Rampa jest 2-kaflowa, więc ta krawędź trafiała na styk obu kafli i dzieliła podjazd na pół
(screenshot `terrain-v3`). Usunięte.

**Ścianka boczna zostaje w sprite'cie rampy (bez wariantu „inner").** Obawa, że przy rampie
2-kaflowej ścianka wewnętrznego kafla będzie widoczna, okazała się nieuzasadniona: wierzch kafla
sąsiedniego (rysowanego później, bo ma większe `gx+gy`) zawiera wszystkie trzy wierzchołki tego
klina, więc go zamalowuje. Kontrakt `docs/architecture.md` („sprite rampy zawiera własne ścianki
boczne") zostaje bez zmian, a atlas bez czterech nadmiarowych klatek.

## 2026-09-14 — Render elewacji: `src/render/terrainPaint.ts` jako czysty moduł

Logika „co i w jakiej kolejności trafia na `RenderTexture`" wyszła z `GameScene` do osobnego,
**czystego** modułu `src/render/terrainPaint.ts` (`paintTerrain`, `paintTile`, `PutFrame`).
Powód: to jedyna część renderu, która ma nietrywialne reguły (kolejność malarska, wybór
`cliff_s`/`cliff_e`, wyjątek dla ramp), a w `GameScene` była nietestowalna bez przeglądarki.
Teraz `tests/render/terrain-paint.test.ts` sprawdza kolejność (`gx + gy`, potem `gx`), wybór klatek
i przesunięcia pionowe — także na prawdziwym świecie z `generateWorld(42)`. `GameScene` wstrzykuje
tylko `put`, czyli jedyny fragment zależny od Phasera.

**Pozycja klatki liczona z `pivot` atlasu, nie z tabel offsetów.** `put()` robi
`left = środekKafla.x - pivotX * w`, `top = środekKafla.y + dy - pivotY * h` (z `Math.round`),
dokładnie tak jak wzorcowy `terrainScene()` w `scripts/preview-sprites.ts`. Dzięki temu zmiana
geometrii sprite'a (np. inny `ELEV_PX` albo wyższa ramka rampy) nie wymaga ruszania renderu —
wystarczy nowy `pivot` w `assets/src/terrain.ts`. Uwaga na konwencję: w renderze punktem
odniesienia jest **środek kafla** `gridToScreen(tx + 0.5, ty + 0.5)` (podgląd używa
`gridToScreen(tx, ty)` i traktuje go jako środek — te same wzory, przesunięte o pół kafla).

**Zapas nad mapą: `TERRAIN_TOP_MARGIN = 2 × ELEV_PX`.** Wierzch kafla poziomu 1 idzie o `ELEV_PX`
ponad bounding box z `mapBounds()`, a sprite rampy (32×26, pivot 18/26) sięga o kolejne `ELEV_PX`
ponad wierzch swojego kafla. `RenderTexture` i `camera.setBounds` dostają ten zapas u góry;
`mapBounds()` w `iso.ts` zostaje nietknięte, bo opisuje siatkę, a nie wysokość terenu.

**Wysokość jednostek liczona co klatkę z pozycji interpolowanej.** `unitScreenPos()` odejmuje
`elevationAt(world, gx, gy) * ELEV_PX` od `gridToScreen` dla sprite'a i cienia, więc wjazd rampą
jest płynny (zmierzone: elev 0.25/0.50/0.75/1.00 → podniesienie 2.5/5/7.5/10 px). Drzewa i głazy
(`buildProp`) dostają to samo przesunięcie raz, przy tworzeniu. `depth` zostaje po współrzędnych
siatki (`depthFor`) — podnoszenie sprite'a nie może zmieniać kolejności rysowania, bo to ta sama
kolumna siatki, a kafle są malowane od tyłu do przodu.

**HUD: `elev X.X`.** Druga linia debugowa pokazuje `elevationAt` pod robotnikiem (ułamek na rampie).
Bez tego nie da się z samego zrzutu ekranu odróżnić „stoi na płaskowyżu" od „stoi obok niego" —
krawędzie N i W nie mają ścian, więc płaskowyż od tej strony nie jest widoczny.

## 2026-09-14 — Czytelność płaskowyżu i ramp po playteście renderu (rąbek + jaśniejszy wierzch + podjazd)

Playtest (`elev-b.png`) pokazał dwie dziury w czytelności: (1) rampy `ramp_e`/`ramp_s` czytały się
jako cienka pomarańczowa kreska, (2) płaskowyż od strony N/W nie miał żadnej sylwetki — ściany tam
nie istnieją (poprawnie), więc wierzch zlewał się z gruntem za nim.

**Oba warianty naraz: rąbek `ledge_*` ORAZ jaśniejszy wierzch `tile_grass_hi*`.** Nie „jedno albo
drugie": rąbek mówi „TU kończy się płaskowyż" (działa na krawędzi), jaśniejszy kafel mówi „jestem
wyżej" (działa też wtedy, gdy krawędź jest poza kadrem — a przy zoomie 3 na telefonie to normalna
sytuacja). Osobno każdy z nich zostawiał jeden z tych przypadków nierozwiązany.
- `ledge_n` / `ledge_w` — 16×9, malowane PO wierzchu kafla, z tym samym przesunięciem. 1 px `cream`
  na samej sylwetce + 2 px `darkGreen` cienia pod nim. „1 px" to **dwa** piksele na rząd: krawędź
  iso ma nachylenie 2:1, więc pojedynczy piksel na rząd dałby kreskę przerywaną, nie linię.
  Warunek malowania jest dokładnie ten sam, co dla ściany klifu (`cliffVisible`), tylko dla sąsiada
  N/W: sąsiad niżej i nie jest rampą prowadzącą na ten kafel (od N rampa ma kierunek `S`, od W — `E`).
  Dzięki temu rąbek nigdy nie zamyka wjazdu.
- `tile_grass_hi{0,1,2}` — te same siatki co `tile_grass{0,1,2}`, paleta o krok jaśniejsza
  (`green` zamiast `midGreen` w bazie). `h` == `b`, bo nad `green` nie ma już zieleni w EDG32:
  górne krawędzie kafli płaskowyżu są gładkie, rysunek trzyma dolna krawędź (`d` = `midGreen`).
  `tile_dirt`/`tile_water` nie mają wariantów hi — na płaskowyżach ich nie ma, a gdyby były,
  jaśniejsza ziemia kłamałaby o materiale.

**Rampy `e`/`s`: widać z nich WYŁĄCZNIE 6-pikselowy pasek — zmierzone, nie oszacowane.** Zrzut
diagnostyczny (cała wstęga drogi na cyjan, cały nasyp i ścianka na magentę) pokazał zero magenty:
wierzch sąsiada poziomu 1, podniesiony o ELEV_PX, nachodzi na diament rampy i zasłania cały nasyp.
Geometrycznie: krawędź W tego wierzchu biegnie równolegle do krawędzi NW kafla rampy, 6 px niżej.
Stąd trzy wnioski, które zmieniły plan:
- rozjaśnienie samego nasypu (`clay`/`leather` zamiast `brown`/`darkBrown`) **nic nie daje w grze** —
  i tak jest niewidoczny. Zostawione, bo pomaga w podglądzie i przy pojedynczym kaflu płaskowyżu;
- stopnie w tych rampach biegną **równolegle** do widocznego paska (linie stałego `h` mają w rzucie
  ten sam kierunek, co krawędź W kafla), więc czytały się jako pasy wzdłuż drogi, a nie jako schody.
  W `ramp_n`/`ramp_w` jest odwrotnie (stopnie w poprzek) i tam działają — dlatego ich nie ruszamy;
- jedyne, co zostało, to **poszerzyć widoczny pasek**: `apron()` przedłuża wstęgę drogi o
  `RAMP_APRON = 5` px w górę, w zapas, który sprite rampy i tak ma nad diamentem, z 1-px rąbkiem
  `darkBrown` na styku z trawą. Pasek rośnie z 6 do ~11 px — na zoomie 2 to 22 px ekranowe.

**Apron świadomie wychodzi poza własny kafel.** To odstępstwo od rzutu: dosypana ziemia leży na
kaflu obok (niżej), rysowanym WCZEŚNIEJ, więc nie zostaje zamalowana. Nie kłamie o kolizjach —
ten kafel i tak jest przechodni, a rysunek mówi tylko „tędy się wjeżdża". Rzadki przypadek
(seed 42, rampa (51,7)): sąsiad od strony podjazdu też jest na poziomie 1 i apron maluje ziemię
na jego wierzchu. Obejrzane na zrzucie — wygląda jak wydeptana ścieżka schodząca z płaskowyżu,
więc zostaje; alternatywą byłyby warianty sprite'a per otoczenie, a to cztery klatki więcej.

**Droga rampy jest teraz najjaśniejszym elementem terenu** (`tan` baza, `cream` nos stopnia,
`clay` żwir, `brown` podstopnica). Wjazd to informacja krytyczna dla gracza — ma wygrywać kontrastem
z trawą i z szarym klifem. Rąbek `ledge_*` też jest `cream`, ale nie myli się z rampą: rąbek to
włos grubości 1 px, rampa to wstęga 11 px z ciemnym konturem.

**Nie ma cienia u podnóża ścian S/E.** Sprawdzone na zrzutach: ściany S/E i tak czytają się dobrze
(mają własny kontur `black`), a dodatkowy pas przyciemnienia na kaflu niżej wymagałby piątej klatki
i kolejnej reguły w `paintTile`. Problem był wyłącznie po stronie N/W.

## 2026-09-14 — Faza 2 w symulacji: rąbanie, budowanie, tartak

Wszystko zgodnie z sekcją „Faza 2 — ekonomia i budowanie (kontrakt)" w `docs/architecture.md`.
Poniżej rzeczy, których kontrakt nie rozstrzygał, oraz jedno świadome odstępstwo.

**Pieńki nie blokują, nadrąbane drzewa tak.** `chops == 1` → `chopped` (kafel dalej zablokowany),
`chops >= trees.chopsToStump` → `stump` i `blocked = 0`. To jedyne miejsce w symulacji, w którym
kafel przestaje blokować w trakcie rundy, więc pieniek jest jednocześnie nagrodą (skrót przez las)
i sygnałem dla gracza, że drzewo jest wyczerpane. Render ma tu tylko zmienić klatkę.

**Przerwanie akcji jest w jednym miejscu: `applyActionCommands` (`systems/chopping.ts`).**
`movement.ts` nic nie wie o akcjach; dostał za to wydzielony `setMoveIntent(unit, dir)`, z którego
korzysta zarówno `applyMoveCommands`, jak i przerwanie rąbania. W `tick.ts` kolejność to
`applyMoveCommands` → `applyActionCommands` → `applyBuildCommands`, dzięki czemu przy kilku
komendach dla tej samej jednostki w jednym ticku **wygrywa ostatnia komenda w tablicy**:
`chop` po `move` zeruje prędkość, `move` po `chop` kasuje akcję i przywraca ruch.
`move` z `dir: null` (puszczony joystick) świadomie NIE przerywa rąbania — inaczej rąbanie byłoby
niemożliwe do utrzymania na mobile.

**Budowa nie wymaga robotnika przy budynku.** `buildTicksLeft--` co tick, niezależnie od tego, gdzie
jest robotnik i co robi (kontrakt). Konsekwencja: da się postawić mur i od razu uciec — to celowe,
bo drag-to-build ma stawiać ciągi murów w biegu, a ucieczka przed wampirem jest sednem gry.
Budynek w budowie ma pełne HP, blokuje kafle, ale nie działa (tartak nie produkuje).

**Tartak liczy drzewa raz na sekundę, nie co tick — i wtedy dopisuje całą sekundę produkcji.**
To odstępstwo od litery kontraktu („co tick `woodFrac += woodPerSecond / TICK_RATE`"): tempo jest
identyczne (2 drewna/s), ale drewno dochodzi porcjami co `TICK_RATE` ticków zamiast po 0,1.
Powód: predykat „czy w promieniu 6 kafli jest drzewo" to przejście po ~600 drzewach na budynek;
co tick to praca na marne. Cache per budynek odpada, bo musiałby żyć poza `World` (moduł), a wtedy
`cloneWorld` dawałby świat z innym cache i determinizm by się posypał; trzymanie flagi w `Building`
byłoby zmianą kontraktu typu. Wybrane rozwiązanie nie wymaga żadnego dodatkowego stanu.
`woodFrac` zostaje w `World` i w hashu — przyda się, gdy ulepszenia dadzą ułamkowe tempo.

**`canPlaceBuilding` nie alokuje.** Jest wołane przy każdym ruchu palca w trybie budowy (~60×/s),
więc wyniki to zamrożone stałe modułu: jeden obiekt `{ok:true}` i po jednym na każdy powód.
Sprawdzenia idą po kaflach footprintu (max 2×2) i po jednostkach — bez tablic pośrednich.
Kolejność warunków = kolejność z kontraktu, pierwszy niespełniony daje `reason`; przy footprincie,
który jest jednocześnie rampą i mieszaną elewacją, zobaczysz `rampa`. Brak jednostki o podanym id
daje `poza zasięgiem` (nie ma kto budować).

**Zasięg budowy liczony do środków kafli footprintu.** „Odległość do najbliższego kafla" z kontraktu
rozstrzygnięta jako odległość środka jednostki do środka najbliższego kafla footprintu; przy
`rangeTiles = 5` daje to zasięg mniej więcej pięciu kafli w pionie i poziomie i ~3,5 na skos.

**Hash stanu rozszerzony (`tests/determinism.test.ts` — nowe przypięte wartości).**
Doszły `woodFrac`, `tree.chops`, `unit.action` (kod typu, id celu, `ticksLeft`) i cała lista
`buildings`, w jawnej kolejności pól. Snapshoty: `hashWorld(generateWorld(42))` = `d1522955`
(było `788ea845`), a po 1000 tickach skryptu = `f20e6dcd` (było `0b025216`). Skrypt testowy
dostał rąbanie i stawianie murów (przez `nearestChoppableTree` i `canPlaceBuilding`) oraz zapas
200 drewna na start — bez zapasu 1000 ticków nie starcza na pierwszy mur i ścieżka budowania nie
byłaby w ogóle sprawdzana. Osobny test pilnuje, że skrypt naprawdę rąbie i buduje.

## 2026-09-14 — Faza 2: mur z auto-tilingiem (geometria, pivot, ciągłość)

**Mur to bryła, nie obrazek.** `wall_0`…`wall_15` powstają w `scripts/gen-grids.ts` przez rzutowanie
prostopadłościanów wyciągniętych z prostokątów w przestrzeni kafla `(fx, fy)`: słupek 10 × 18 px
w środku kafla + dla każdego bitu maski segment 6 px szerokości i 14 px wysokości od środka kafla
do środka krawędzi. Piksel jest zamalowany, gdy dla pewnego `h ∈ [0, H]` punkt `invMap(px, py + h)`
leży w podstawie; widać powierzchnię o największym `h` (wierzch, gdy `h == H`, inaczej ściana E albo S).
Ściany N/W są tyłem do kamery i nigdy się nie rysują — ta sama reguła, co w `cliff_*`.

**Pivot `{0.5, 0.75}` zamiast „środek kafla na dole sprite'a".** Zadanie mówiło, żeby środek kafla
wypadł w ostatnim wierszu sprite'a. Tak się nie da: segmenty S i E schodzą 4–5 px **poniżej** środka
kafla (dobijają do środków dolnych krawędzi diamentu), więc pivot na samym dole ucinałby im stopy
i robił szczelinę dokładnie tam, gdzie mur ma się łączyć z sąsiadem. Płótno jest więc 32×32, dolne
16 wierszy to bounding box diamentu kafla, a pivot leży w środku kafla, czyli w 24. wierszu
(`24/32 = 0.75`). Pozycjonowanie: `left = screenX(środek kafla) − 16`, `top = screenY − 24`.

**Ciągłość: kontur liczony z „duchami" sąsiadów.** Bit maski jest ustawiony tylko wtedy, gdy sąsiad
też jest murem, więc przekrój na krawędzi ZAWSZE ma kontynuację po drugiej stronie. Gdyby każdy
sprite dostał pełny kontur po swojej sylwetce, na każdej granicy kafli pojawiłaby się ciemna kreska
(a sam przekrój — gdyby konturu nie było — zostałby dziurą, bo ściana N/W sąsiada jest niewidoczna).
Rozwiązanie: sprite jest rasteryzowany dwa razy — raz sam, raz razem z „duchami" segmentów sąsiadów
— a kontur dostają tylko te piksele, które sąsiadują z przezroczystością w masce ŁĄCZNEJ. Piksele
duchów są potem kasowane. Efekt: mury sklejają się w jedną ścianę, co pilnuje
`tests/assets/walls.test.ts` (przekrój na krawędzi w całości zamalowany, brak konturu w środku
ściany, 4-spójność prostego muru i pełnego kwadratu 5×5).

**Kontur `navy`, nie `darkSlate`.** Kontrakt zadania mówił `darkSlate`, ale `darkSlate` jest już
spoiną ściany E. Kontur musi być o krok ciemniejszy od najciemniejszej ściany, inaczej sylwetka
muru ginie i nie da się (ani okiem, ani testem) odróżnić fugi od szwu między kaflami. Drabina:
wierzch `lightGrey`/`grey`, ściana S `grey`/`slate`, ściana E `slate`/`darkSlate`, kontur `navy`.
Ściana S jaśniejsza od E — to samo światło z góry-lewej, co w klifach.

**Kolejność rysowania murów ma znaczenie.** Przekrój na granicy kafli jest zamalowany przez sprite
BLIŻSZY kamerze; render musi rysować mury po rosnącym `x + y` (czyli po `depthFor(x+1, y+1)`).
Przy odwrotnej kolejności na styku zostałaby widoczna ścianka czołowa dalszego kafla.

**`wall_build` = jedna klatka rusztowania.** Mur w budowie to ten sam słupek, ale z desek
(`tan`/`leather`/`brown`, kontur `darkBrown`) z poziomymi prześwitami i pionowymi słupkami
w narożnikach — bez segmentów, bo niedokończony mur jeszcze się z niczym nie łączy. Render używa
go z alfą i paskiem postępu; auto-tiling włącza się dopiero po `buildTicksLeft == 0`.

## 2026-09-14 — Faza 2: budynki (tartak, generator, wieża)

**Kotwica = dolny narożnik footprintu.** Wszystkie trzy mają `anchor {0.5, 1}`, a punktem
odniesienia jest punkt siatki `(x + w, y + h)` — dokładnie ten sam, z którego liczy się `depth`
(`depthFor(x + w, y + h)`). Dzięki temu pozycja i kolejność rysowania biorą się z jednej liczby,
a render nie potrzebuje tabel offsetów per budynek (pełna tabela w `docs/architecture.md`).

**Bryła jest wpuszczona w footprint.** Budynek 2×2 w płótnie 64×48 nie może wypełnić diamentu
footprintu (64 × 32 px) i mieć jeszcze wysokości — zostałoby 16 px na ściany i dach. Podstawy są
więc mniejsze od footprintu (tartak: chata 46 px szerokości + stos desek i koło piły, generator:
cokół 32 px), a bryła stoi kilka pikseli nad dolnym narożnikiem. Zyskujemy na tym miejsce na dach
i to, że 2×2 nie zachodzi na sąsiednie kafle. Test w `tests/assets/registry.test.ts` sprawdza
rozmiary, kotwicę i to, że środek ciężkości podstawy leży na osi kotwicy (± 6 px — tartak jest
asymetryczny: chata z lewej, stos desek z prawej).

**Rysowane ręcznie, ale sylwetki brył z rusztowania.** `assets/src/buildings.ts` to zwykłe siatki
znaków, edytowalne ręcznie i będące jedynym źródłem prawdy. Pierwsza wersja sylwetek (prostopadłościany
iso, dach czterospadowy, fugi kamienia, deski) powstała w jednorazowym skrypcie roboczym poza repo —
rysowanie 64×48 linii iso 2:1 na piechotę kończy się przekrzywionymi krawędziami. Wszystkie detale
(wrota, strzelnice, blanki, koło piły, stos desek, cewka, kryształ, świecący właz) są dorysowane
ręcznie na tej siatce. Gdyby bryła miała się zmienić, prościej jest przerysować ją ręcznie niż
odtwarzać skrypt — dlatego nie trafił on do `scripts/`.

**Kontur budynków: `black`, nie `darkSlate`.** Budynki są duże i mają stać w kadrze jak drzewa
i głazy (te też mają kontur `black`/`darkBrown`). Mur ma jaśniejszy kontur (`navy`), bo jest
powtarzalnym kafelkiem — czarna siatka co 32 px robiłaby z placu kratownicę.

**Generator: kamień + miedź + kryształ.** Cokół kamienny (ta sama drabina szarości co mur),
na nim trzy miedziane zwoje (`amber`/`clay`) nawinięte na ciemny rdzeń, w nich kryształ
(`cyan`/`white`/`darkBlue`). Pierwsza wersja miała pierścienie jako pełne elipsy jedna na drugiej —
wyglądało to jak tort, bo nie było widać rdzenia. Zwoje mają teraz 2 px i przerwy, przez które widać
ciemny rdzeń. Cyjan pojawia się też jako świecący właz na ścianie cokołu — inaczej bryła była
„kamiennym pudłem z ozdobą na górze".

## 2026-09-14 — Faza 2: HUD jako DRUGI atlas (`hud.png`)

PLAN §6 chce HUD w SVG rasteryzowanym „do 2×", a atlas świata jest pixel artem 1× ładowanym
z `pixelArt: true`. To dwa różne filtrowania tej samej tekstury, więc HUD dostał własny atlas:
`assets/src/hud/*.svg` → `scripts/build-hud.ts` → `assets/build/hud.png` + `hud.json`
(ten sam format „JSON Hash", `meta.scale = "2"`, pivot każdej klatki `{0.5, 0.5}`).
Ikony mają 32×32 viewBox (64 px w atlasie), `btn_ring` 96 (192 px), `radial_slot` 64 (128 px);
render skaluje je o 0.5 i rysuje kamerą HUD bez zoomu.

`npm run atlas` buduje OBA atlasy — `scripts/build-atlas.ts` w trybie „main" woła `buildHud()`.
Świadomie bez zmiany `package.json`: jeden skrypt = jedno wejście, a `preview-sprites.ts` i testy
wołają `buildAtlas()` / `buildHud()` bezpośrednio. `publicDir = assets/build` kopiuje oba atlasy
do builda bez dodatkowej konfiguracji Vite.

Kolory ikon: `cream` z konturem `black` (stroke 1.6–1.8 w jednostkach viewBoxa), czyli dalej
Endesga 32 — pilnuje tego `tests/assets/hud.test.ts`, który parsuje SVG i odrzuca kolor spoza palety.
Przyciski (`btn_ring`, `radial_slot`) to jedyne klatki z alfą (`fill-opacity` 0.35 i 0.5) — mają
przyciemniać grę pod spodem, a nie ją zasłaniać.
