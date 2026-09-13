/**
 * DSL pixel artu (PLAN.md §6 „Pixel art jako kod").
 *
 * Sprite = paleta znaków + siatka znaków. `.` jest zawsze przezroczysty.
 * Walidacja jest twarda i natychmiastowa (przy imporcie modułu), żeby błędny grid
 * wywalił `npm run atlas` / `npm test` z jasnym komunikatem, a nie cicho wyrenderował dziurę.
 */
import { PALETTE_HEX } from './palette.ts';

export interface Anchor {
  /** 0..1, 0 = lewa krawędź, 1 = prawa. */
  x: number;
  /** 0..1, 0 = góra, 1 = dół. */
  y: number;
}

export interface SpriteDef {
  name: string;
  palette: Readonly<Record<string, string | null>>;
  frames: readonly (readonly string[])[];
  width: number;
  height: number;
  anchor: Anchor;
}

export interface SpriteOptions {
  palette: Record<string, string | null>;
  frames: string[][];
  /** Domyślnie `{ x: 0.5, y: 1 }` (stopa jednostki). Kafle: `{ x: 0.5, y: 0.5 }`. */
  anchor?: Anchor;
  name?: string;
}

/** Znak zawsze przezroczysty, niezależnie od palety sprite'a. */
export const TRANSPARENT_CHAR = '.';

/** Domyślna kotwica: stopa (środek dołu). */
export const ANCHOR_FOOT: Anchor = { x: 0.5, y: 1 };
/** Kotwica kafla: środek diamentu. */
export const ANCHOR_TILE: Anchor = { x: 0.5, y: 0.5 };

/**
 * Wyjątek od palety Endesga 32: czerń z kanałem alfa (`#000000rr`).
 * Używana wyłącznie przez `shadow` (elipsa cienia pod jednostkami, PLAN.md §6 „cień pod jednostkami").
 * Dodanie alfy do palety EDG32 byłoby jej rozszerzeniem; półprzezroczysta czerń nie wnosi
 * nowego odcienia, tylko przyciemnia to, co pod spodem.
 */
const ALPHA_BLACK_RE = /^#000000[0-9a-f]{2}$/;

function isAllowedColor(hex: string): boolean {
  return PALETTE_HEX.has(hex) || ALPHA_BLACK_RE.test(hex);
}

function fail(name: string, message: string): never {
  throw new Error(`sprite "${name}": ${message}`);
}

/** Tworzy i waliduje definicję sprite'a. */
export function sprite(options: SpriteOptions): SpriteDef {
  const name = options.name ?? '<anonymous>';
  const { frames } = options;

  if (frames.length === 0) fail(name, 'brak klatek (frames: [])');

  const palette: Record<string, string | null> = { [TRANSPARENT_CHAR]: null };
  for (const [char, value] of Object.entries(options.palette)) {
    if (char.length !== 1) fail(name, `klucz palety "${char}" musi być jednym znakiem`);
    if (value === null) {
      palette[char] = null;
      continue;
    }
    const hex = value.toLowerCase();
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
      fail(name, `kolor "${value}" (znak "${char}") nie jest postaci #rrggbb ani #rrggbbaa`);
    }
    if (!isAllowedColor(hex)) {
      fail(name, `kolor "${value}" (znak "${char}") spoza palety Endesga 32 (assets/src/palette.ts)`);
    }
    palette[char] = hex;
  }

  const firstFrame = frames[0]!;
  if (firstFrame.length === 0) fail(name, 'klatka 0 nie ma wierszy');
  const height = firstFrame.length;
  const width = firstFrame[0]!.length;
  if (width === 0) fail(name, 'klatka 0 ma pusty wiersz 0');

  frames.forEach((frame, fi) => {
    if (frame.length !== height) {
      fail(name, `klatka ${fi} ma ${frame.length} wierszy, oczekiwano ${height} (jak klatka 0)`);
    }
    frame.forEach((row, ri) => {
      if (row.length !== width) {
        fail(name, `klatka ${fi}, wiersz ${ri}: długość ${row.length}, oczekiwano ${width}`);
      }
      for (const char of row) {
        if (!(char in palette)) {
          fail(name, `klatka ${fi}, wiersz ${ri}: znak "${char}" nie występuje w palecie sprite'a`);
        }
      }
    });
  });

  return {
    name,
    palette,
    frames: frames.map((frame) => [...frame]),
    width,
    height,
    anchor: options.anchor ?? ANCHOR_FOOT,
  };
}

/**
 * Lustrzane odbicie w poziomie — z dwóch narysowanych kierunków (SE, NE)
 * robimy pozostałe dwa (SW, NW). Kotwica X odbija się razem z gridem.
 */
export function flipX(def: SpriteDef, name?: string): SpriteDef {
  return {
    ...def,
    name: name ?? `${def.name}_flipX`,
    frames: def.frames.map((frame) => frame.map((row) => [...row].reverse().join(''))),
    anchor: { x: 1 - def.anchor.x, y: def.anchor.y },
  };
}

/** Kolor piksela klatki albo `null` (przezroczysty). Poza zakresem → `null`. */
export function pixelAt(def: SpriteDef, frameIndex: number, x: number, y: number): string | null {
  const frame = def.frames[frameIndex];
  if (!frame) return null;
  const row = frame[y];
  if (row === undefined) return null;
  const char = row[x];
  if (char === undefined) return null;
  return def.palette[char] ?? null;
}

/** Klatka → surowy bufor RGBA (width × height × 4). */
export function frameToRGBA(def: SpriteDef, frameIndex: number): Uint8Array {
  const out = new Uint8Array(def.width * def.height * 4);
  for (let y = 0; y < def.height; y += 1) {
    for (let x = 0; x < def.width; x += 1) {
      const hex = pixelAt(def, frameIndex, x, y);
      if (hex === null) continue;
      const i = (y * def.width + x) * 4;
      out[i] = Number.parseInt(hex.slice(1, 3), 16);
      out[i + 1] = Number.parseInt(hex.slice(3, 5), 16);
      out[i + 2] = Number.parseInt(hex.slice(5, 7), 16);
      out[i + 3] = hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) : 255;
    }
  }
  return out;
}

/** Nazwy klatek w atlasie: jednoklatkowe bez sufiksu, wieloklatkowe `_0`, `_1`, … */
export function frameNames(key: string, def: SpriteDef): string[] {
  if (def.frames.length === 1) return [key];
  return def.frames.map((_, i) => `${key}_${i}`);
}
