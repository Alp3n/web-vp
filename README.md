# Nightfall

Izometryczna gra survival 2.5D w przeglądarce (PWA, mobile-first, orientacja pozioma).
Człowiek rąbie drewno, buduje mury i wieże i próbuje przetrwać 12 minut; wampir z każdą minutą rośnie w siłę.

Stack: TypeScript + Vite + **Phaser 3** (WebGL) + vite-plugin-pwa + Vitest + ESLint. Bez frameworków UI.

## Start

```bash
npm i
npm run dev      # Vite z --host: otwórz na telefonie w tej samej sieci
```

Build produkcyjny i podgląd:

```bash
npm run build    # atlas -> tsc --noEmit -> vite build (dist/)
npm run preview  # serwuje dist/ na :4173
```

Jakość:

```bash
npm run ci       # typecheck + lint + test + build
```

## Dokumenty

- [`PLAN.md`](./PLAN.md) — plan gry i fazy pracy.
- [`docs/architecture.md`](./docs/architecture.md) — wiążący kontrakt modułów (stałe, API `src/sim`, iso, pipeline assetów).
- [`CLAUDE.md`](./CLAUDE.md) — zasady pracy i skrypty.
- [`docs/decisions.md`](./docs/decisions.md), [`docs/playtest-log.md`](./docs/playtest-log.md), [`docs/later.md`](./docs/later.md).

## Status

Faza 0 — fundament: szkielet projektu, `balance.ts`, `rng.ts`, pusta scena Phasera z licznikiem FPS, PWA, CI i deploy na GitHub Pages.
