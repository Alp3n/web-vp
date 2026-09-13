/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_HEX } from '../../assets/src/palette.ts';
import { ANCHOR_FOOT, flipX, frameToRGBA, frameNames, sprite } from '../../assets/src/sprite.ts';

describe('palette', () => {
  it('ma dokładnie 32 unikalne kolory Endesga 32', () => {
    expect(Object.keys(PALETTE)).toHaveLength(32);
    expect(PALETTE_HEX.size).toBe(32);
  });

  it('każdy kolor to lowercase #rrggbb', () => {
    for (const hex of PALETTE_HEX) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('sprite() — walidacja', () => {
  it('odrzuca kolor spoza palety, podając nazwę sprite\'a i znak', () => {
    expect(() =>
      sprite({ name: 'zły', palette: { x: '#123456' }, frames: [['x']] }),
    ).toThrowError(/sprite "zły".*#123456.*znak "x".*Endesga 32/s);
  });

  it('odrzuca nierówne wiersze klatki', () => {
    expect(() =>
      sprite({ name: 'krzywy', palette: { a: PALETTE.white }, frames: [['aa', 'aaa']] }),
    ).toThrowError(/sprite "krzywy".*wiersz 1.*długość 3.*oczekiwano 2/s);
  });

  it('odrzuca klatki o różnej liczbie wierszy', () => {
    expect(() =>
      sprite({ name: 'nierówny', palette: { a: PALETTE.white }, frames: [['a', 'a'], ['a']] }),
    ).toThrowError(/klatka 1 ma 1 wierszy/);
  });

  it('odrzuca znak spoza palety sprite\'a', () => {
    expect(() =>
      sprite({ name: 'obcy', palette: { a: PALETTE.white }, frames: [['ab']] }),
    ).toThrowError(/znak "b" nie występuje w palecie/);
  });

  it('odrzuca pustą listę klatek', () => {
    expect(() => sprite({ name: 'pusty', palette: {}, frames: [] })).toThrowError(/brak klatek/);
  });

  it('akceptuje czerń z alfą jako udokumentowany wyjątek (cień)', () => {
    const def = sprite({ name: 'cień', palette: { s: '#00000059' }, frames: [['s']] });
    expect(def.palette['s']).toBe('#00000059');
    expect(Array.from(frameToRGBA(def, 0))).toEqual([0, 0, 0, 0x59]);
  });

  it('odrzuca inny kolor z alfą niż czerń', () => {
    expect(() => sprite({ name: 'alfa', palette: { s: '#ff000059' }, frames: [['s']] })).toThrowError(
      /spoza palety Endesga 32/,
    );
  });

  it('"." jest przezroczysty nawet bez deklaracji w palecie', () => {
    const def = sprite({ name: 'dot', palette: { a: PALETTE.white }, frames: [['.a']] });
    expect(Array.from(frameToRGBA(def, 0))).toEqual([0, 0, 0, 0, 255, 255, 255, 255]);
  });

  it('domyślna kotwica to stopa {0.5, 1}', () => {
    const def = sprite({ name: 'x', palette: { a: PALETTE.white }, frames: [['a']] });
    expect(def.anchor).toEqual(ANCHOR_FOOT);
  });
});

describe('flipX()', () => {
  const def = sprite({
    name: 'strzałka',
    palette: { a: PALETTE.white, b: PALETTE.red },
    frames: [['ab..', 'a...']],
    anchor: { x: 0.25, y: 1 },
  });

  it('odbija każdy wiersz i kotwicę X', () => {
    const flipped = flipX(def, 'strzałka_flip');
    expect(flipped.frames[0]).toEqual(['..ba', '...a']);
    expect(flipped.anchor).toEqual({ x: 0.75, y: 1 });
    expect(flipped.name).toBe('strzałka_flip');
  });

  it('dwa odbicia dają oryginał', () => {
    expect(flipX(flipX(def)).frames).toEqual(def.frames);
  });
});

describe('frameNames()', () => {
  it('sprite jednoklatkowy nie dostaje sufiksu, wieloklatkowy dostaje _i', () => {
    const one = sprite({ name: 'a', palette: { a: PALETTE.white }, frames: [['a']] });
    const two = sprite({ name: 'b', palette: { a: PALETTE.white }, frames: [['a'], ['a']] });
    expect(frameNames('a', one)).toEqual(['a']);
    expect(frameNames('b', two)).toEqual(['b_0', 'b_1']);
  });
});
