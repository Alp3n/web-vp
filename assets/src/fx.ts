/**
 * Efekty Fazy 2 — rysowane ręcznie, kotwica w środku (cząstki pozycjonuje render).
 *  - `fx_chip` 3×3: wiór spod siekiery (drewno: tan + jasny rdzeń cream),
 *  - `fx_hit`  8×8: żółty błysk uderzenia (na później — wieże, walka).
 */
import { PALETTE } from './palette.ts';
import { sprite, type Anchor, type SpriteDef } from './sprite.ts';

/** Cząstki są małe i latają swobodnie — kotwica w środku, nie u podstawy. */
const ANCHOR_CENTRE: Anchor = { x: 0.5, y: 0.5 };

/** Wiór drewna: 3×3, widoczny nawet na ciemnej korze. */
export const fx_chip: SpriteDef = sprite({
  name: 'fx_chip',
  anchor: ANCHOR_CENTRE,
  palette: { t: PALETTE.tan, c: PALETTE.cream },
  frames: [
    [
      '.t.',
      'tct',
      '.t.',
    ],
  ],
});

/** Błysk uderzenia: 8×8, żółty rdzeń + bursztynowa poświata. */
export const fx_hit: SpriteDef = sprite({
  name: 'fx_hit',
  anchor: ANCHOR_CENTRE,
  palette: { a: PALETTE.amber, y: PALETTE.yellow, W: PALETTE.white },
  frames: [
    [
      '...aa...',
      '..ayya..',
      '.ayWWya.',
      'ayWWWWya',
      'ayWWWWya',
      '.ayWWya.',
      '..ayya..',
      '...aa...',
    ],
  ],
});
