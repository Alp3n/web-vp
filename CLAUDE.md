# CLAUDE.md — Nightfall

Kontrakt architektury: **`docs/architecture.md`** (wiążący). Plan i fazy: **`PLAN.md`**.
Dziennik playtestów: `docs/playtest-log.md`. Decyzje: `docs/decisions.md`. Pomysły na później: `docs/later.md`.

## Zasady pracy (PLAN.md §8)

- Zawsze zaczynaj od przeczytania `PLAN.md` i `docs/playtest-log.md`. Pracuj fazami, nie wyprzedzaj planu.
- Małe commity opisane jako „fazaN: co i dlaczego". Przed każdym commitem: `npm run typecheck && npm test && npm run build`.
- `src/sim` nie importuje nic z Phasera, DOM ani `assets/`. Testy sim działają bez przeglądarki.
- Każda liczba balansu trafia do `balance.ts`, nigdy inline.
- Nowe zależności tylko z uzasadnieniem w commicie. Bez bibliotek UI.
- Nie implementuj sieci, lobby, kont, sklepu ani reklam. Pomysły zapisuj w `docs/later.md`.
- Grafiki wyłącznie przez pipeline (`.ts` grid lub `.svg` → atlas). Żadnych ręcznych PNG w repo. Każdy nowy sprite: preview → screenshot → ocena → dopiero użycie.
- Jeśli coś w planie okazuje się złe w praktyce (np. drag-to-build jest niewygodny), zmień to, ale zapisz decyzję i powód w `docs/decisions.md`.
- Raz na fazę test na prawdziwym telefonie przez deploy preview.

## Skrypty npm

| skrypt | co robi |
| --- | --- |
| `npm run dev` | Vite dev server (`--host`, żeby wejść z telefonu w tej samej sieci) |
| `npm run build` | `atlas` → `tsc --noEmit` → `vite build` (wynik w `dist/`) |
| `npm run preview` | serwuje `dist/` (`--host`), domyślnie port 4173 |
| `npm test` | Vitest (`tests/**/*.test.ts`, środowisko node) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config; osobne reguły czystości dla `src/sim/**`) |
| `npm run atlas` | `scripts/build-atlas.ts` → `assets/build/atlas.png|json`, `icon.svg` |
| `npm run preview:sprites` | `scripts/preview-sprites.ts` → `assets/build/preview.html` |
| `npm run screenshot` | `scripts/screenshot.ts -- --url=… --out=… --viewport=844x390` (headless Chromium) |
| `npm run ci` | typecheck + lint + test + build (to samo, co w GitHub Actions) |

## Kontrola jakości grafiki

`npm run preview:sprites`, potem `npm run preview` lub statyczny serwer i `npm run screenshot`.
**Nie akceptuj sprite'a, którego nie widziałeś wyrenderowanego.**
