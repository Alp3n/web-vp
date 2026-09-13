import Phaser from 'phaser';
import type { Dir8 } from '../sim';
import { dirFromVector } from '../sim';
import { screenToGrid } from '../render/iso';
import { HUD_DEPTH } from '../render/Hud';

/** Maksymalny wychył gałki w px ekranowych. */
export const MAX_RADIUS = 48;
/** Poniżej tego wychyłu (px ekranowe) joystick nie daje kierunku. */
export const DEAD_ZONE = 10;
const KNOB_RADIUS = 20;
const BASE_COLOR = 0xe6e8f0;
const BASE_ALPHA = 0.25;
const KNOB_ALPHA = 0.5;

/**
 * Wektor ekranowy -> `Dir8` w przestrzeni siatki.
 * Liczy się **tylko obrót** układu (bez translacji), więc „w prawo" na ekranie
 * to zawsze ruch w prawo na ekranie, niezależnie od pozycji kamery.
 */
export function screenVectorToDir(vx: number, vy: number): Dir8 | null {
  const grid = screenToGrid(vx, vy);
  const len = Math.hypot(grid.x, grid.y);
  if (len === 0) return null;
  return dirFromVector(grid.x / len, grid.y / len);
}

/**
 * Pływający joystick (PLAN.md §3): pojawia się tam, gdzie palec dotknie **lewej połowy**
 * ekranu i żyje do puszczenia tego samego `pointer.id`. Prawa połowa jest wolna —
 * Faza 2 postawi tam przycisk akcji, więc tamtych pointerów nie przechwytujemy.
 *
 * Dodatkowo WASD/strzałki na desktopie — mapowane tak samo (wektor ekranowy -> iso),
 * żeby „w prawo" znaczyło to samo dla palca i dla klawisza.
 */
export class Joystick {
  /** Grafika joysticka — scena wrzuca ją na kamerę HUD. */
  readonly graphics: Phaser.GameObjects.Graphics;

  private readonly scene: Phaser.Scene;
  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private knobX = 0;
  private knobY = 0;
  private dir: Dir8 | null = null;

  private readonly keysUp: Phaser.Input.Keyboard.Key[] = [];
  private readonly keysDown: Phaser.Input.Keyboard.Key[] = [];
  private readonly keysLeft: Phaser.Input.Keyboard.Key[] = [];
  private readonly keysRight: Phaser.Input.Keyboard.Key[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      const codes = Phaser.Input.Keyboard.KeyCodes;
      this.keysUp.push(keyboard.addKey(codes.W), keyboard.addKey(codes.UP));
      this.keysDown.push(keyboard.addKey(codes.S), keyboard.addKey(codes.DOWN));
      this.keysLeft.push(keyboard.addKey(codes.A), keyboard.addKey(codes.LEFT));
      this.keysRight.push(keyboard.addKey(codes.D), keyboard.addKey(codes.RIGHT));
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Bieżący kierunek: joystick ma pierwszeństwo, w razie braku — klawiatura. */
  getDir(): Dir8 | null {
    if (this.pointerId !== null) return this.dir;
    return this.keyboardDir();
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  /** Przerysowuje bazę i gałkę (wołane co klatkę ze sceny — dwa okręgi, koszt pomijalny). */
  draw(): void {
    const g = this.graphics;
    g.clear();
    if (this.pointerId === null) return;
    g.fillStyle(BASE_COLOR, BASE_ALPHA);
    g.fillCircle(this.baseX, this.baseY, MAX_RADIUS);
    g.fillStyle(BASE_COLOR, KNOB_ALPHA);
    g.fillCircle(this.baseX + this.knobX, this.baseY + this.knobY, KNOB_RADIUS);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.graphics.destroy();
  }

  private keyboardDir(): Dir8 | null {
    let vx = 0;
    let vy = 0;
    if (isDown(this.keysLeft)) vx -= 1;
    if (isDown(this.keysRight)) vx += 1;
    if (isDown(this.keysUp)) vy -= 1;
    if (isDown(this.keysDown)) vy += 1;
    if (vx === 0 && vy === 0) return null;
    return screenVectorToDir(vx, vy);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    // Tylko lewa połowa ekranu; prawa zostaje wolna dla akcji z Fazy 2.
    if (pointer.x >= this.scene.scale.width / 2) return;
    this.pointerId = pointer.id;
    this.baseX = pointer.x;
    this.baseY = pointer.y;
    this.knobX = 0;
    this.knobY = 0;
    this.dir = null;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    let dx = pointer.x - this.baseX;
    let dy = pointer.y - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > MAX_RADIUS) {
      dx = (dx / len) * MAX_RADIUS;
      dy = (dy / len) * MAX_RADIUS;
    }
    this.knobX = dx;
    this.knobY = dy;
    this.dir = len < DEAD_ZONE ? null : screenVectorToDir(dx, dy);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.knobX = 0;
    this.knobY = 0;
    this.dir = null;
  }
}

function isDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  for (const key of keys) {
    if (key.isDown) return true;
  }
  return false;
}
