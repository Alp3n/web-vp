import Phaser from 'phaser';

/** Depth ponad światem; HUD i tak jedzie na osobnej kamerze (zoom 1). */
export const HUD_DEPTH = 1_000_000;

const MARGIN_X = 8;
const MARGIN_Y = 6;
const LINE_H = 15;
const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const FONT_SIZE = '12px';
const PANEL_PAD = 5;
const PANEL_ALPHA = 0.55;
const PANEL_RADIUS = 3;

export interface HudStats {
  fps: number;
  tick: number;
  seed: number;
  gx: number;
  gy: number;
}

/**
 * HUD Fazy 1: jedna linia statusu + linia debugowa z pozycją jednostki.
 *
 * Renderowany przez osobną kamerę HUD (patrz `GameScene`), bo kamera główna ma zoom 2–3,
 * który rozjechałby tekst. `setResolution(2)` trzyma go ostrym na ekranach HiDPI.
 */
export class Hud {
  /** Ciemna podkładka — bez niej tekst ginie na jasnej trawie. */
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly status: Phaser.GameObjects.Text;
  private readonly debug: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH - 1);
    this.status = this.makeText(scene, MARGIN_Y, '#e6e8f0');
    this.debug = this.makeText(scene, MARGIN_Y + LINE_H, '#8be28b');
  }

  private makeText(scene: Phaser.Scene, y: number, color: string): Phaser.GameObjects.Text {
    return scene.add
      .text(MARGIN_X, y, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE,
        color,
      })
      .setOrigin(0, 0)
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setShadow(0, 1, '#000000', 2, false, true);
  }

  /** Obiekty HUD — kamera świata musi je zignorować. */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.panel, this.status, this.debug];
  }

  update(stats: HudStats): void {
    this.status.setText(`FPS ${Math.round(stats.fps)} · tick ${stats.tick} · seed ${stats.seed}`);
    this.debug.setText(`gx ${stats.gx.toFixed(1)} · gy ${stats.gy.toFixed(1)}`);
    this.drawPanel();
  }

  private drawPanel(): void {
    const width = Math.max(this.status.width, this.debug.width) + PANEL_PAD * 2;
    const height = LINE_H * 2 + PANEL_PAD;
    this.panel.clear();
    this.panel.fillStyle(0x0b0c14, PANEL_ALPHA);
    this.panel.fillRoundedRect(
      MARGIN_X - PANEL_PAD,
      MARGIN_Y - PANEL_PAD / 2,
      width,
      height,
      PANEL_RADIUS,
    );
  }

  /** HUD jest zakotwiczony w lewym górnym rogu — po resize wystarczy przypiąć go z powrotem. */
  resize(): void {
    this.status.setPosition(MARGIN_X, MARGIN_Y);
    this.debug.setPosition(MARGIN_X, MARGIN_Y + LINE_H);
  }

  destroy(): void {
    this.panel.destroy();
    this.status.destroy();
    this.debug.destroy();
  }
}
