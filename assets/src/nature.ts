/**
 * WYGENEROWANE przez `npx tsx scripts/gen-grids.ts` — edytuj generator, nie ten plik.
 *
 * Drzewo 24×36 (pień w kolumnach 10..13 → środek 12.0 = anchor.x × 24, dół pnia w ostatnim rzędzie),
 * pniak 8×8, cień 16×8, debugowa kropka 1×1.
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_FOOT, sprite, type SpriteDef } from './sprite.ts';

/** a = cień korony, b = liście, c = światło; p/q/o = pień, w = świeże drewno w nacięciu. */
const TREE = {
  a: PALETTE.darkGreen,
  b: PALETTE.midGreen,
  c: PALETTE.green,
  p: PALETTE.brown,
  q: PALETTE.leather,
  o: PALETTE.darkBrown,
  w: PALETTE.tan,
};

export const tree_full: SpriteDef = sprite({
  name: 'tree_full',
  anchor: ANCHOR_FOOT,
  palette: TREE,
  frames: [
    [
      '........................',
      '........................',
      '......ccc...............',
      '....cccbbcc.............',
      '...cbbbbcbbcccccccc.....',
      '..cbbbbbbbcbbbbbbbbb....',
      '..cbbbbbbbbbcbbbbbbbb...',
      '.cbbbbbbbbbbbbcbbbbbaa..',
      '.cbcbbbbbbbbbbbbbbbbba..',
      '.cbbbcbbbbbbbbbbbbbbba..',
      '..cbbbbcbbbbbbbbbbbbba..',
      '..cbbbbbbcbbbbbbbbbbba..',
      '..cbbbbbbbbcbbbbbabbba..',
      '..cbbbbbbbbbbbbbbbbbba..',
      '..cbbbbbbbbbbbbbbbabba..',
      '..cbcbbbbbbbbabbbbbbba..',
      '..cbbbcbbbbbbbbbbbbaba..',
      '..cbbbbbbbbbbbabbbbbba..',
      '...cbbbbbabbbbbbbbbba...',
      '...cbbbbbbbbbbbabbbba...',
      '....bbbbbbabbbbbbbba....',
      '....bbbbbbbbbbbbabba....',
      '.....abbbbbabbbbbba.....',
      '.....aabbbbbbbbbbaa.....',
      '......abbbbbabbbba......',
      '......aabbbbbbbbaa......',
      '........aabbbaaa........',
      '..........aaaa..........',
      '..........qppo..........',
      '..........qppo..........',
      '..........qppo..........',
      '..........qppo..........',
      '..........qppo..........',
      '..........qppo..........',
      '.........pqppoo.........',
      '.........qpppoo.........',
    ],
  ],
});

export const tree_chopped: SpriteDef = sprite({
  name: 'tree_chopped',
  anchor: ANCHOR_FOOT,
  palette: TREE,
  frames: [
    [
      '........................',
      '........................',
      '........................',
      '......ccc...............',
      '....ccbbccc.............',
      '...cbbbbbbccccccccc.....',
      '...cbbbbbbbbcbbbbbbb....',
      '..cbbbbbbbbbbbcbbbbba...',
      '..ccbbbbbbbbbbccbbbba...',
      '..cbbcbbbbbbbc...bbba...',
      '...cbbbcbbbbbc...abba...',
      '...cbbbbbcbbbb...abba...',
      '...cbbbbccbcbbbaaabba...',
      '...cbbbc..cbbbbbbbbba...',
      '...cbbc....bbbbbbbaba...',
      '...ccbc....bbabbbbbba...',
      '...cbbcc..bbbbbaabbaa...',
      '...cbbbbbbbbbba..abba...',
      '....cbbbbabbba....aa....',
      '....cbbbbbbbba....aa....',
      '.....bbbbbabbba..aa.....',
      '.....bbbbbbbbbbaaba.....',
      '......abbbbabbbbba......',
      '......abbbbbbbbbba......',
      '.......abbbbabbba.......',
      '........aabbbbaa........',
      '..........aaaa..........',
      '..........qppo..........',
      '..........qppo..........',
      '..........qppw..........',
      '..........qpw...........',
      '..........qww...........',
      '..........qpwp..........',
      '..........qppo..........',
      '.........pqppoo.........',
      '.........qpppoo.........',
    ],
  ],
});

export const tree_stump: SpriteDef = sprite({
  name: 'tree_stump',
  anchor: ANCHOR_FOOT,
  palette: { w: PALETTE.tan, r: PALETTE.skinShade, q: PALETTE.leather, p: PALETTE.brown, o: PALETTE.darkBrown },
  frames: [
    [
      '..qqqq..',
      '.qwwwwq.',
      'qwwrrwwq',
      'qwrwwrwo',
      'qpppppoo',
      'qppppooo',
      '.ppoooo.',
      '..oooo..',
    ],
  ],
});

/**
 * Cień pod jednostkami: czerń z alfą ~35 % (`#00000059`) — jedyny dozwolony wyjątek
 * od palety Endesga 32, patrz `assets/src/sprite.ts` i `docs/decisions.md`.
 */
export const shadow: SpriteDef = sprite({
  name: 'shadow',
  anchor: { x: 0.5, y: 0.5 },
  palette: { s: '#00000059' },
  frames: [
    [
      '....ssssssss....',
      '..ssssssssssss..',
      '.ssssssssssssss.',
      'ssssssssssssssss',
      'ssssssssssssssss',
      '.ssssssssssssss.',
      '..ssssssssssss..',
      '....ssssssss....',
    ],
  ],
});

/** 1×1 biały — debug, paski HUD, linie. */
export const dot: SpriteDef = sprite({
  name: 'dot',
  anchor: { x: 0.5, y: 0.5 },
  palette: { w: PALETTE.white },
  frames: [['w']],
});
