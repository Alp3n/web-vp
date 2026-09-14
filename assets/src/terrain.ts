/**
 * WYGENEROWANE przez `npx tsx scripts/gen-grids.ts` — edytuj generator, nie ten plik.
 *
 * Teren wywyższony (docs/architecture.md „Wywyższenia (elewacja)"):
 *  - `cliff_s`, `cliff_e` — ściany klifu 16×(8+ELEV_PX), leżą WEWNĄTRZ nieprzesuniętego
 *    diamentu kafla (od krawędzi wierzchu podniesionego o ELEV_PX w dół do gruntu);
 *  - `ramp_{n|e|s|w}` — 32×(16+ELEV_PX): pochyły wierzch + widoczna ścianka boczna;
 *    `_inner` to ten sam wierzch bez ścianki (wewnętrzny kafel rampy 2-kaflowej);
 *  - `rock_small`, `rock_big` — głazy, kotwica u podstawy.
 *
 * Pozycjonowanie względem `gridToScreen(gx, gy)` wynika wprost z `pivot` w atlasie:
 *   cliff_s: left = screenX − 16, top = screenY − ELEV_PX
 *   cliff_e: left = screenX,      top = screenY − ELEV_PX
 *   ramp_*:  left = screenX − 16, top = screenY − (8 + ELEV_PX)
 */
import { PALETTE } from './palette.ts';
import { ANCHOR_FOOT, sprite, type Anchor, type SpriteDef } from './sprite.ts';

/** MUSI być równe `ELEV_PX` z `src/sim/balance.ts` (assets nie importuje z src). */
export const ELEV_PX = 10;

/** Wysokość sprite'a ściany klifu i rampy. */
const CLIFF_H = 8 + ELEV_PX; // 18
const RAMP_H = 16 + ELEV_PX; // 26

/** Prawy-dolny narożnik sprite'a siedzi w dolnym narożniku kafla → left = screenX − 16. */
const ANCHOR_CLIFF_S: Anchor = { x: 1, y: ELEV_PX / CLIFF_H }; // 0.555556
/** Lustrzanie: lewy brzeg sprite'a w dolnym narożniku kafla → left = screenX. */
const ANCHOR_CLIFF_E: Anchor = { x: 0, y: ELEV_PX / CLIFF_H };
/** Dolny (nieprzesunięty) diament rampy pokrywa kafel → top = screenY − (8 + ELEV_PX). */
const ANCHOR_RAMP: Anchor = { x: 0.5, y: (8 + ELEV_PX) / RAMP_H }; // 0.692308

/**
 * Skała ściany S (jaśniejsza — światło z góry-lewej pada na ścianę zwróconą w +gy).
 * g = trawiasty rąbek pod wierzchem, l = światło, b = baza, d = cień, o = kontur.
 */
const ROCK_S = {
  g: PALETTE.darkGreen,
  l: PALETTE.slate,
  b: PALETTE.darkSlate,
  d: PALETTE.navy,
  o: PALETTE.black,
};

/** Skała ściany E — każdy odcień o jeden krok ciemniejszy niż w `ROCK_S`. */
const ROCK_E = {
  g: PALETTE.darkTeal,
  l: PALETTE.darkSlate,
  b: PALETTE.navy,
  d: PALETTE.navy,
  o: PALETTE.black,
};

/**
 * Ścianki rampy: ubita ZIEMIA, nie skała. Rampa jest usypana, a nie wykuta — brąz odróżnia ją
 * od szarych klifów i sprawia, że mocno skrócone perspektywicznie `ramp_e`/`ramp_s`
 * (wznoszą się w stronę kamery) czytają się jako jeden obiekt z drogą na górze,
 * a nie jako kamienny blok z pomarańczową kreską. Odstępstwo od „kolory ścianek jak `cliff_*`".
 */
const RAMP_WALL = {
  g: PALETTE.brown,
  l: PALETTE.leather,
  b: PALETTE.brown,
  d: PALETTE.darkBrown,
  o: PALETTE.black,
};

/** Wierzch rampy: ubita droga. r = baza, c = nos stopnia (światło), t = żwir, n = podstopnica i rąbek. */
const ROAD = {
  r: PALETTE.leather,
  c: PALETTE.clay,
  t: PALETTE.tan,
  n: PALETTE.darkBrown,
};

/**
 * Głaz: l = błysk, g/s/d = trzy odcienie bryły (światło z góry-lewej), o = kontur, m = mech.
 * Ta sama drabina wartości co ściany klifu — głaz ma być z tej samej skały co płaskowyż.
 */
const ROCK = {
  l: PALETTE.lightGrey,
  g: PALETTE.slate,
  s: PALETTE.darkSlate,
  d: PALETTE.navy,
  o: PALETTE.black,
  m: PALETTE.darkGreen,
};

export const cliff_s: SpriteDef = sprite({
  name: 'cliff_s',
  anchor: ANCHOR_CLIFF_S,
  palette: ROCK_S,
  frames: [
    [
      'g...............',
      'lgg.............',
      'bllgg...........',
      'bdbllgg.........',
      'dbbbbllgg.......',
      'bddlbbbllgg.....',
      'bbbdbbbblllgg...',
      'bbbbldddbbbllgg.',
      'ddddbbbddbbbdllg',
      'oddddbbbdddbbbbl',
      '.ooddddbbbbddblb',
      '...oodbddblbbddb',
      '.....ooddddbbbbb',
      '.......ooddbdbdl',
      '.........ooddddb',
      '...........ooddd',
      '.............ood',
      '...............o',
    ],
  ],
});

export const cliff_e: SpriteDef = sprite({
  name: 'cliff_e',
  anchor: ANCHOR_CLIFF_E,
  palette: ROCK_E,
  frames: [
    [
      '...............g',
      '.............ggl',
      '...........ggllb',
      '.........ggllbbb',
      '.......ggllbdblb',
      '.....ggllbbbbddl',
      '...ggllblbbddbbb',
      '.ggllbbdbddbbbdd',
      'gllbbbbddbbbbddd',
      'ldblbddbdblbdddo',
      'bbbdbbbbbddddoo.',
      'bddblbbddddoo...',
      'dbbdbddddoo.....',
      'bbbdddboo.......',
      'bddddoo.........',
      'bddoo...........',
      'doo.............',
      'o...............',
    ],
  ],
});

export const ramp_n: SpriteDef = sprite({
  name: 'ramp_n',
  anchor: ANCHOR_RAMP,
  palette: { ...ROAD, ...RAMP_WALL },
  frames: [
    [
      '................r...............',
      '...............rrrr.............',
      '..............rtrrrrr...........',
      '.............rrrrrrrrrr.........',
      '............rrrrrrrrrrrrt.......',
      '...........nrrrrrrrrtrrrrrr.....',
      '..........rcnnrrtrrrrrrrrrrrr...',
      '.........rrrccnnrrrrrrrrrrrrrtr.',
      '........trrrrrccnnrrrrrrrtrrrrrr',
      '........rrrrrrrrccnnrtrrrrrrrrrn',
      '.......rrrrrrrrrrtccnnrrrrrrrrnl',
      '......rrrrrrrtrrrrrrccnnrrrrrnlb',
      '.....rnnrtrrrrrrrrrrrrccnntrnlbb',
      '....rtccnnrrrrrrrrrrrrtrccrnlblb',
      '...rrrrrccnnrrrrrrtrrrrrrrnldbdl',
      '..rrrrrrrrccnntrrrrrrrrrrnlbbdbb',
      '.rrrrrrrrrtrccnnrrrrrrrrnlbbdbdd',
      'rrrrrrtrrrrrrrccnnrrrrrtlbbdbbdo',
      '.rtrrrrrrrrrrrrrccnnrrrnlbdbboo.',
      '...rrrrrrrrrrrrtrrccnrnlbdboo...',
      '.....rrrrrrtrrrrrrrrcnlbdoo.....',
      '.......trrrrrrrrrrrrnlboo.......',
      '.........rrrrrrrrrrnloo.........',
      '...........rrrrrtrnoo...........',
      '.............rrrroo.............',
      '...............ro...............',
    ],
  ],
});

export const ramp_e: SpriteDef = sprite({
  name: 'ramp_e',
  anchor: ANCHOR_RAMP,
  palette: { ...ROAD, ...RAMP_WALL },
  frames: [
    [
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '............................rrr.',
      '....................ntrnnrrrrll.',
      '...............rrnnrcnnccrrllbb.',
      '.............trnnccnnccrrllbblb.',
      '...........rrnnccnnccrrlldbbldb.',
      '.........rrnnccnnccrrllbdbbddbl.',
      '.......rrnnccnnccrtllbbbbddbbdb.',
      '.....rrnnccnrccrrllbbbbddbbbddd.',
      '...rrrrccrtcnnnnllbbbddbbbbdddd.',
      '.rrrnnnnnnnnlllllbbddbbbbddddoo.',
      '.oonlllllllldbbbbddbblbbdddoooo.',
      '...oobbblbbbbblbddbbldbddoooo...',
      '.....oodbbbbdddbdbbddddoooo.....',
      '.......oodddbbblbddddoooo.......',
      '.........oobbbdbdddoooo.........',
      '...........ooddddoooo...........',
      '.............oodooo.............',
      '...............oo...............',
    ],
  ],
});

export const ramp_s: SpriteDef = sprite({
  name: 'ramp_s',
  anchor: ANCHOR_RAMP,
  palette: { ...ROAD, ...RAMP_WALL },
  frames: [
    [
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '.rrr............................',
      '.llrtrrnnrrn....................',
      '.bdllrrccnncrnnrr...............',
      '.bbdbllrrccnnccnnrr.............',
      '.ddbbbblltrccnnccnnrr...........',
      '.bbddblbbllrrccnnccnnrt.........',
      '.bbbbddlbbbllrrccnnccnnrr.......',
      '.bdbbbbdbbbbbllrrccrnccnnrr.....',
      '.ddddbdblbdbbbblnnnncrrccrrtr...',
      '.oodddddblbddbdbllllnnnnnnnnrrr.',
      '.ooooddddbbbbdddbdbbllllllllnoo.',
      '...ooooddddbbbbdbbblbbbblbboo...',
      '.....ooooddddbbbddddbbbdboo.....',
      '.......oooodbddbbbbbbddoo.......',
      '.........oooobddbbbdloo.........',
      '...........oooodbddoo...........',
      '.............ooodoo.............',
      '...............oo...............',
    ],
  ],
});

export const ramp_w: SpriteDef = sprite({
  name: 'ramp_w',
  anchor: ANCHOR_RAMP,
  palette: { ...ROAD, ...RAMP_WALL },
  frames: [
    [
      '...............r................',
      '.............rrrr...............',
      '...........rrrrtrr..............',
      '.........rrtrrrrrrr.............',
      '.......trrrrrrrrrrrr............',
      '.....rrrrrrrrrrrrrrrn...........',
      '...rrrrrrrrrrrrrtrnncr..........',
      '.rrrrrrrrrrrtrrrnnccrrr.........',
      'rrrrrrrrtrrrrrnnccrrrrrr........',
      'nrrrtrrrrrrrnnccrrrrrtrr........',
      'lnrrrrrrrrnnccrrrtrrrrrrr.......',
      'blnrrrrrnnccrtrrrrrrrrrrrr......',
      'bdlnrrnnccrrrrrrrrrrrrrrnnt.....',
      'dbblntccrrrrrrrrrrrrrrnnccrr....',
      'bdbblnrrrrrrrrrrrrtrnnccrrrrr...',
      'bbdlblnrrrrrrrtrrrnnccrrrrrrrr..',
      'bbbdbblnrrtrrrrrnnccrrrrrrrtrrr.',
      'odbbbbblrrrrrrnnccrrrrrtrrrrrrrr',
      '.oodldbbnrrrnnccrrrtrrrrrrrrrrr.',
      '...oobddlnrnccrtrrrrrrrrrrrrr...',
      '.....oodllncrrrrrrrrrrrrrrr.....',
      '.......ooblnrrrrrrrrrrrrt.......',
      '.........oolnrrrrrrrtrr.........',
      '...........oonrrtrrrr...........',
      '.............oorrrr.............',
      '...............or...............',
    ],
  ],
});

export const rock_big: SpriteDef = sprite({
  name: 'rock_big',
  anchor: ANCHOR_FOOT,
  palette: ROCK,
  frames: [
    [
      '......oooo..........',
      '....oollggoo........',
      '...ollggssssoo......',
      '..olgggssssssoo.....',
      '.olggggsssssssddoo..',
      '.ogggggssssssssdddo.',
      'oggggggsssssssdddddo',
      'ogggggsssssssddddddo',
      'oggggssssssssddddddo',
      'ogggsssssssssddddddo',
      'oogsssssssssdddddddo',
      '.oossssssssdddddddoo',
      '..oosssssssdddddoo..',
      '...ooosssssdddddoo..',
      '....mmoooooooooo....',
      '.....mmooooooom.....',
    ],
  ],
});

export const rock_small: SpriteDef = sprite({
  name: 'rock_small',
  anchor: ANCHOR_FOOT,
  palette: ROCK,
  frames: [
    [
      '...oooo.....',
      '..ollggo....',
      '.olgggssso..',
      'ogggssssddo.',
      'oggsssssddo.',
      'ogssssssdddo',
      '.osssssdddo.',
      '..oossdddo..',
      '..mooooooo..',
      '...moooom...',
    ],
  ],
});
