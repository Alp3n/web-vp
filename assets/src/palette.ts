/**
 * Paleta globalna (PLAN.md §6): Endesga 32 (EDG32), max 32 kolory.
 * Każdy sprite z `assets/src` korzysta wyłącznie z tych wartości —
 * `assets/src/sprite.ts` waliduje to przy tworzeniu `SpriteDef`,
 * a `scripts/build-atlas.ts` jeszcze raz przed zapisem atlasu.
 *
 * Jedyny dozwolony wyjątek: czerń z alfą (`#000000rr`) dla cienia — patrz `ALPHA_BLACK_RE`
 * w `sprite.ts` i wpis w `docs/decisions.md`.
 */
export const PALETTE = {
  // czerwienie / brązy ciepłe
  rust: '#be4a2f',
  clay: '#d77643',
  cream: '#ead4aa',
  tan: '#e4a672',
  leather: '#b86f50',
  brown: '#733e39',
  darkBrown: '#3e2731',
  // czerwienie
  bloodRed: '#a22633',
  red: '#e43b44',
  // pomarańcze / żółcie
  orange: '#f77622',
  amber: '#feae34',
  yellow: '#fee761',
  // zielenie
  green: '#63c74d',
  midGreen: '#3e8948',
  darkGreen: '#265c42',
  darkTeal: '#193c3e',
  // błękity
  darkBlue: '#124e89',
  blue: '#0099db',
  cyan: '#2ce8f5',
  // szarości / chłodne ciemności
  white: '#ffffff',
  lightGrey: '#c0cbdc',
  grey: '#8b9bb4',
  slate: '#5a6988',
  darkSlate: '#3a4466',
  navy: '#262b44',
  black: '#181425',
  // akcenty
  crimson: '#ff0044',
  purple: '#68386c',
  magenta: '#b55088',
  pink: '#f6757a',
  skin: '#e8b796',
  skinShade: '#c28569',
} as const satisfies Record<string, string>;

export type PaletteName = keyof typeof PALETTE;
export type PaletteHex = (typeof PALETTE)[PaletteName];

/** Wszystkie dozwolone kolory (lowercase `#rrggbb`). */
export const PALETTE_HEX: Set<string> = new Set<string>(Object.values(PALETTE));

if (PALETTE_HEX.size !== 32) {
  throw new Error(`palette.ts: Endesga 32 musi mieć 32 unikalne kolory, jest ${PALETTE_HEX.size}`);
}
