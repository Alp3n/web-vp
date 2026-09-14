# PLAN.md — Vampirism Mobile (nazwa robocza: „Nightfall")

## 0. Cel i zakres

- Gra 2.5D (izometryczna) w przeglądarce jako PWA, mobile-first, orientacja pozioma, sterowanie dwoma kciukami.
- Wersja 1: **single-player** — 1 człowiek vs 1 wampir sterowany przez AI. Bez sieci.
- Architektura od początku gotowa na późniejszy co-op/PvP: deterministyczna symulacja + wszystkie akcje jako komendy.
- Inspiracja: Vampirism Fire (Warcraft 3). Pętla: rąb drewno → buduj mury i wieże → przetrwaj do końca timera. Wampir z każdą minutą rośnie w siłę.

## 1. Stack (nie zmieniać bez pytania)

- TypeScript, Vite, Phaser 3 (WebGL), vite-plugin-pwa, Vitest, ESLint.
- Pipeline grafik: skrypty Node w `scripts/` (sharp do rasteryzacji SVG i składania atlasów).
- Brak frameworków UI (React, Redux itp.). HUD w Phaserze albo cienki overlay DOM.
- W `src/sim` zero `Math.random` i `Date.now` — seedowany RNG (mulberry32) i licznik ticków.

## 2. Architektura

```
src/
  sim/            # czysta logika; NIE importuje Phasera ani DOM. Deterministyczna.
    world.ts      # stan gry: entities, grid, zasoby, timer
    tick.ts       # step(world, commands[]) -> world
    commands.ts   # Move, Chop, Build, Repair, Attack, Cancel, UseSkill...
    systems/      # movement, chopping, building, combat, economy, pathfinding
    balance.ts    # WSZYSTKIE liczby balansu w jednym miejscu
    rng.ts
  ai/             # FSM wampira; produkuje komendy tak samo jak gracz
  render/         # Phaser: sceny, sprite'y, kamera, projekcja iso, HUD
  input/          # joystick, przyciski, tryb budowy -> komendy
  pwa/            # service worker, manifest, save/load (IndexedDB)
assets/
  src/            # źródła: pixel art jako .ts (paleta + grid) oraz .svg
  build/          # wygenerowane atlasy (w .gitignore)
scripts/
  build-atlas.ts
  preview-sprites.ts
tests/
docs/
  playtest-log.md
  decisions.md
  later.md
```

- Symulacja: stały tick 20 Hz. Render interpoluje pozycje między tickami.
- Grid: mapa 64×64 kafli iso. Kafel to diament 32×16 px (rysowany 1×, kamera zoom 2–3).
- Budynki: 1×1 (mur, wieża), 2×2 (tartak, generator).
- Wywyższenia (dodane po playteście Fazy 1): dwa poziomy terenu (0 i 1). Płaskowyże (2–4 na mapę) z klifami, które działają jak ściany. Wejście na płaskowyż tylko rampą o szerokości 2 kafli (min. 1 rampa na płaskowyż). Głazy jako statyczne przeszkody. Reguły w `docs/architecture.md` („Wywyższenia"); wampir w Fazie 3 musi uwzględniać rampy w A*.
- Wszystko, co zmienia świat, jest komendą. Gracz i AI generują komendy identycznie — to później umożliwi multiplayer bez przepisywania.

## 3. Sterowanie (pozioma orientacja)

- **Lewy kciuk**: pływający joystick — pojawia się w miejscu dotknięcia lewej połowy ekranu. Ruch 8-kierunkowy w przestrzeni iso.
- **Prawy kciuk**:
  - duży przycisk akcji kontekstowej: przy drzewie = rąb, przy uszkodzonym budynku = napraw, w trybie budowy = postaw;
  - przycisk „Buduj" otwiera menu radialne (mur, wieża, tartak, generator, ulepszenia);
  - tryb budowy: „duch" budynku przyklejony do siatki przed robotnikiem, zielony/czerwony; **drag-to-build** — przeciągnięcie palcem po siatce stawia ciąg murów. To kluczowa wygoda na mobile.
- Kamera: follow z lekkim wyprzedzeniem w kierunku ruchu; delikatne przybliżenie w trybie budowy.
- Zasada: wszystkie akcje dostępne bez odrywania kciuków od ekranu.

## 4. Design gry v1 (wartości startowe — wpisać do `balance.ts`, tuningować)

- Runda: 12 min. Człowiek wygrywa, gdy przeżyje; wampir wygrywa, gdy go zabije.
- Człowiek: robotnik (HP 100, prędkość 1.0). Rąbanie: 5 s → 10 drewna. Tartak zbiera drewno z promienia 6 kafli.
- Budynki:
  - mur — 50 drewna, HP 400
  - wieża — 150 drewna, dmg 20, zasięg 5 kafli, 1 strzał/s
  - tartak — 100 drewna, pasywnie +2 drewna/s w promieniu drzew
  - generator — 200 drewna, +1 złota/s
  - ulepszenia murów/wież — za złoto (+50% HP / +50% dmg na poziom, max 3)
- Wampir: HP 800, dmg 40, prędkość 1.15 (szybszy od robotnika — to fundament napięcia), regeneracja 2% HP/s poza walką. Co minutę: +5% dmg, +5% HP. Umiejętności: sprint (3 s, cooldown 20 s), „węch" (2 s widzi kierunek do najbliższego człowieka, cooldown 45 s).
- Mgła wojny dla człowieka: nie w v1. Wampir natomiast nie zna pozycji gracza, dopóki go nie usłyszy lub nie zobaczy.
- **Fun check po Fazie 3**: czy sama „ucieczka + obudowanie się" jest emocjonująca bez wież? Jeśli nie — wracaj do tuningu zamiast dodawać treści.

## 5. AI wampira (`src/ai/`)

Maszyna stanów:

- **ROAM** — chodzi po losowych punktach, preferuje nieodwiedzone rejony.
- **INVESTIGATE** — usłyszał rąbanie (promień 12 kafli) lub strzał wieży (20 kafli); idzie do źródła.
- **HUNT** — ma linię wzroku do gracza; goni, używa sprintu, gdy dystans rośnie.
- **SIEGE** — gracz za murami; wybiera segment o najniższym HP / najkrótszej ścieżce i atakuje. Jeśli wieże zadają > 15 dmg/s → odwrót i próba z innej strony.
- **RETREAT** — HP < 30%; ucieka, regeneruje, zapamiętuje pozycję bazy i wraca.

Pathfinding: A* na gridzie; mury nie blokują, tylko kosztują `HP_muru / dmg_wampira` ticków — AI samo wybiera słabe punkty. Trudność = skalowanie statystyk i skracanie czasu ROAM, nigdy oszukiwanie (AI nie widzi gracza bez sensorów).

## 6. Grafika 2.5D

Kierunek: **pixel art izometryczny** dla świata + **SVG** dla HUD i ikon. Powody: spójny styl, tani render na mobile, oba formaty tworzone w całości w kodzie i wersjonowane w git.

### Pixel art jako kod

Każdy sprite to plik `.ts` z paletą i gridem znaków:

```ts
export const wall_iso = sprite({
  palette: { '.': null, 'a': '#3b2f2f', 'b': '#6b5a4c', 'c': '#8c7a68' },
  frames: [[
    '....abba....',
    '...abccba...',
    // ...
  ]],
});
```

- `scripts/build-atlas.ts` renderuje sprite'y do atlasu PNG + JSON w formacie Phasera. Rysuj w 1×, ładuj z `pixelArt: true`, zoom kamery robi resztę.
- Paleta globalna: max 32 kolory w `assets/src/palette.ts` (w stylu Endesga 32). Każdy sprite korzysta wyłącznie z niej.
- Rozmiary: kafel 32×16 (diament); jednostki 16–24 px wysokości; budynki 1×1 w 32×32, 2×2 w 64×48.
- Kierunki: 4 (NE, SE, SW, NW), pozostałe przez flip. Animacje: idle 2 klatki, walk 4, chop/attack 3.
- Głębia 2.5D: sortowanie po y (`depth = isoY + offset`), lekkie podświetlenie krawędzi od góry, cień pod jednostkami (elipsa z alfą).
- Noc: nakładka koloru na kamerę + sprite'y światła (addytywny blend) przy wieżach i pochodniach — tanie, buduje klimat.

### Lista assetów v1

Kafle: trawa ×3 warianty, ziemia, brzeg wody. Teren wywyższony: ściany klifu (S, E), rampy ×4 kierunki, rąbek górnej krawędzi płaskowyżu, głazy ×2. Drzewo: pełne / nadrąbane / pień. Robotnik. Wampir. Mur z auto-tilingiem (16 wariantów łączeń). Wieża (2 poziomy). Tartak. Generator. Pocisk wieży. Efekty: uderzenie, dym, ciemna „mgła" przy śmierci (bez krwi). Cień.

### SVG (HUD)

Joystick, przyciski, ikony menu radialnego, pasek zasobów, timer, ekrany start/koniec. Rasteryzować przez sharp w `build-atlas` do 2×, żeby były ostre na retinie.

### Kontrola jakości grafik — obowiązkowa

`npm run preview:sprites` generuje `assets/build/preview.html` z siatką wszystkich sprite'ów w powiększeniu ×4. Uruchom, zrób screenshot (Playwright headless) i obejrzyj go przed uznaniem assetu za gotowy. **Nie akceptuj sprite'a, którego nie widziałeś wyrenderowanego.** Jeśli sprite wygląda źle — popraw grid, nie dodawaj obejść w kodzie renderu.

## 7. Fazy — każda kończy się działającym buildem i commitem

### Faza 0 — Fundament
- Vite + TS + Phaser + Vitest + ESLint. Skrypty: `dev | build | test | typecheck | atlas | preview:sprites`.
- Struktura katalogów, `balance.ts`, `rng.ts`, pusta scena z licznikiem FPS.
- Deploy preview (GitHub Pages lub Vercel) — testy na telefonie od pierwszego dnia.
- **DoD**: strona otwiera się na telefonie i pokazuje FPS.

### Faza 1 — Świat i ruch
- Grid iso, generator mapy z seeda: trawa, skupiska drzew, kilka polan.
- Kamera, joystick, robotnik chodzi po mapie, kolizje z drzewami.
- Pierwsze sprite'y: kafle, drzewo, robotnik (4 kierunki, walk).
- Faza 1b (po playteście): płaskowyże z klifami, rampy 2-kaflowe, głazy — w sim, atlasie i renderze.
- **DoD**: test w Vitest — 1000 ticków dla tego samego seeda i tych samych komend daje identyczny hash stanu.

### Faza 2 — Ekonomia i budowanie
- Rąbanie, drewno, tartak, HUD zasobów.
- Tryb budowy: ghost, siatka, mur z auto-tilingiem, drag-to-build.
- **DoD**: da się w 2 minuty obudować pełnym kwadratem murów na telefonie bez frustracji (test ręczny, krótkie nagranie ekranu).

### Faza 3 — Wampir i śmierć
- Wampir-AI z FSM, A*, sensory. Walka, HP, niszczenie murów, game over, restart.
- Timer rundy, ekran wygranej/przegranej.
- **DoD**: 5 rozegranych rund. W `docs/playtest-log.md` zapisz, co było nudne lub niesprawiedliwe. Pierwszy fun check — bez „tak" tutaj nie idziesz dalej.

### Faza 4 — Obrona i rozwój
- Wieże, generator, ulepszenia, naprawa murów, sprint i „węch" wampira.
- Krzywa trudności wampira; cały balans przez `balance.ts`.
- **DoD**: 10 rund; gracz znający zasady wygrywa ok. 40–60%.

### Faza 5 — Polish
- Animacje, efekty, noc i światła, krótkie sfx (opcjonalnie), ekran startowy, tutorial w 3 dymkach.
- Wydajność: 60 FPS na średnim Androidzie, < 150 draw calls, atlas ≤ 2 tekstury 2048².

### Faza 6 — PWA
- Manifest, ikony, service worker z precache assetów, prompt „dodaj do ekranu głównego".
- Autosave stanu do IndexedDB co 10 s, resume po powrocie, pauza na `visibilitychange`.
- Test jako zainstalowana PWA na iOS Safari i Android Chrome.

## 8. Zasady pracy (skopiuj tę sekcję do `CLAUDE.md`)

- Zawsze zaczynaj od przeczytania `PLAN.md` i `docs/playtest-log.md`. Pracuj fazami, nie wyprzedzaj planu.
- Małe commity opisane jako „fazaN: co i dlaczego". Przed każdym commitem: `npm run typecheck && npm test && npm run build`.
- `src/sim` nie importuje nic z Phasera, DOM ani `assets/`. Testy sim działają bez przeglądarki.
- Każda liczba balansu trafia do `balance.ts`, nigdy inline.
- Nowe zależności tylko z uzasadnieniem w commicie. Bez bibliotek UI.
- Nie implementuj sieci, lobby, kont, sklepu ani reklam. Pomysły zapisuj w `docs/later.md`.
- Grafiki wyłącznie przez pipeline (`.ts` grid lub `.svg` → atlas). Żadnych ręcznych PNG w repo. Każdy nowy sprite: preview → screenshot → ocena → dopiero użycie.
- Jeśli coś w planie okazuje się złe w praktyce (np. drag-to-build jest niewygodny), zmień to, ale zapisz decyzję i powód w `docs/decisions.md`.
- Raz na fazę test na prawdziwym telefonie przez deploy preview.

## 9. Pierwsze polecenie do wklejenia

> Przeczytaj PLAN.md. Zrealizuj Fazę 0 i Fazę 1. Po każdej fazie zatrzymaj się i podsumuj: co działa, co pominąłeś, co proponujesz zmienić w planie.
