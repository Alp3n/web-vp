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
