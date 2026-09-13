/**
 * WYGENEROWANE przez `npx tsx scripts/gen-grids.ts` — edytuj generator, nie ten plik.
 *
 * Kafle iso 32×16. Maska diamentu: `|x-15.5|/16 + |y-7.5|/8 <= 1` — sąsiednie kafle
 * przy offsecie (16, 8) stykają się bez dziur i bez nakładania (test: tests/assets/tiles.test.ts).
 * Podświetlenie górnej krawędzi (`h`) i przyciemnienie dolnej (`d`) dają głębię 2.5D (PLAN.md §6).
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_TILE, sprite, type SpriteDef } from './sprite.ts';

const GRASS = {
  b: PALETTE.midGreen,
  h: PALETTE.green,
  d: PALETTE.darkGreen,
  t: PALETTE.green,
};

const GRASS_DARK = {
  b: PALETTE.darkGreen,
  h: PALETTE.midGreen,
  d: PALETTE.darkTeal,
  t: PALETTE.midGreen,
};

const DIRT = {
  b: PALETTE.leather,
  h: PALETTE.skinShade,
  d: PALETTE.brown,
  t: PALETTE.tan,
};

const WATER = {
  b: PALETTE.darkBlue,
  h: PALETTE.blue,
  d: PALETTE.darkTeal,
  t: PALETTE.cyan,
};

export const tile_grass0: SpriteDef = sprite({
  name: 'tile_grass0',
  anchor: ANCHOR_TILE,
  palette: GRASS,
  frames: [
    [
      '...............hh...............',
      '.............hbbbbh.............',
      '...........hbbbdbbbbh...........',
      '.........hbbbbbbbbbbbbh.........',
      '.......hbbbbbbbbbbbbbbbbh.......',
      '.....hbbbbbdbbbbbbbbbbbbbbh.....',
      '...hbbbbbbbbbbbbbbbbbbbbdbbbh...',
      '.hbdbbbbbbbdbbbbbbbbbbbbbbbbbbh.',
      '.dbbbbbbbbbbbbdbbbbbbbbbbbbbbbd.',
      '...dbbbbdbbbbbbbbbbbbbbbbbbbd...',
      '.....dbbbbbbbbbbbbbbbbbbbbd.....',
      '.......dbbbbbbbbdbbbbbbbd.......',
      '.........dbbbbbbbbbdbbd.........',
      '...........dbbbdbbbbd...........',
      '.............dbbbbd.............',
      '...............dd...............',
    ],
  ],
});

export const tile_grass1: SpriteDef = sprite({
  name: 'tile_grass1',
  anchor: ANCHOR_TILE,
  palette: GRASS,
  frames: [
    [
      '...............hh...............',
      '.............hbbbbh.............',
      '...........hbbbbbbbbh...........',
      '.........hbbbbbbbbbbbbh.........',
      '.......hbbtbbbbbbbbbdbbbh.......',
      '.....hbbbbtbdbbbbbbbbbbbbbh.....',
      '...hbbbbbbbbbbbbbbbbbbbbbbbbh...',
      '.hbbbbdtbbbbbbbbbbbbbbbbbbbbbbh.',
      '.dbbbbbtbbbbbbbdbbbbbbtbbbbbbbd.',
      '...dbbbbbbbbbbbbbbbbbbtbtbbbd...',
      '.....dbbbbbbbbbbbbbbbbtbtbd.....',
      '.......dbbbbbbbbbbbbbbtbd.......',
      '.........dbbbbbdbbbbbbd.........',
      '...........dbbbbtbbbd...........',
      '.............dbbtbd.............',
      '...............dd...............',
    ],
  ],
});

export const tile_grass2: SpriteDef = sprite({
  name: 'tile_grass2',
  anchor: ANCHOR_TILE,
  palette: GRASS_DARK,
  frames: [
    [
      '...............hh...............',
      '.............hbbbbh.............',
      '...........hbbbbbbbbh...........',
      '.........hbbbbbbbbdbbbh.........',
      '.......hbbbbbbbbbbbbbbdbh.......',
      '.....hbbbbbbbbbbbbbbbbbbbbh.....',
      '...hbbbbbbbbbdbbbbbbbbbbbbdbh...',
      '.hbbbbbbbdbbbtbbbdbbbdbbbbbbbbh.',
      '.dbbbbbbdtbbbtbbbbbbbbbbbbbbbbd.',
      '...dbbbbbtbdbbbbbbbbbbbbdbdbd...',
      '.....dbbbbbbbbbbbdbbbbbbbbd.....',
      '.......dbbbbbbbbbbbbbbbbd.......',
      '.........dbbbbtbbbbbbbd.........',
      '...........dbbtbbbbbd...........',
      '.............dbbbbd.............',
      '...............dd...............',
    ],
  ],
});

export const tile_dirt: SpriteDef = sprite({
  name: 'tile_dirt',
  anchor: ANCHOR_TILE,
  palette: DIRT,
  frames: [
    [
      '...............hh...............',
      '.............hbbbbh.............',
      '...........hbbbbbdtbh...........',
      '.........hbbbbbdbbbbbbh.........',
      '.......hbbbbbbbbbbbbbbdbh.......',
      '.....hbbdbbbdbbbbbbdbbbbbbh.....',
      '...hbbbbbbbbbbbbbbdbbbbbbbbbh...',
      '.hbbbbbbbbbbbbdbbbbbbbbbbbbbbbh.',
      '.dbbbbbtbbbbbdbbbbbbbbbbbbbbbbd.',
      '...dbbbbbbbbbbtbbbbbbbbbbbbbd...',
      '.....dbdtbbbbbbdbbbtbbbbbbd.....',
      '.......dbtdbbbbbbbbbbbtbd.......',
      '.........dbbbbbbbbbbbbd.........',
      '...........dbbbbbbbbd...........',
      '.............dbbbbd.............',
      '...............dd...............',
    ],
  ],
});

export const tile_water: SpriteDef = sprite({
  name: 'tile_water',
  anchor: ANCHOR_TILE,
  palette: WATER,
  frames: [
    [
      '...............hh...............',
      '.............hbbbbh.............',
      '...........hbbbbbbbbh...........',
      '.........hbbbbbbbbbbbbh.........',
      '.......hbbbbbbbbbbbbbbbbh.......',
      '.....hbbbbtttbbbbbbbbbbbbbh.....',
      '...hbbbbbbbbbbbbbbbbbbbbbbbbh...',
      '.hbbbbbbbbbbbbbbbbbttttbbbbbbbh.',
      '.dbbbbbbbbbbbbbbbbbbbbbbbbbbbbd.',
      '...dbbbtttbbbbbbbbbbbbbbbbbbd...',
      '.....dbbbbbbbbbbbbbbbbbbbbd.....',
      '.......dbbbbbbbtttbbbbbbd.......',
      '.........dbbbbbbbbbbbbd.........',
      '...........dbbbbbbbbd...........',
      '.............dbbbbd.............',
      '...............dd...............',
    ],
  ],
});
