import Phaser from 'phaser';

const FPS_UPDATE_MS = 250;

/**
 * Faza 0: pusta scena — tło, tytuł na środku i licznik FPS w lewym górnym rogu.
 * Faza 1 zastąpi ją `GameScene` (grid iso, kamera, robotnik).
 */
export class BootScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private fpsTimer = 0;

  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;

    this.cameras.main.setBackgroundColor('#0b0c14');

    this.title = this.add
      .text(width / 2, height / 2, 'Nightfall — Faza 0', {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: '28px',
        color: '#e6e8f0',
      })
      .setOrigin(0.5);

    this.fpsText = this.add
      .text(8, 8, 'FPS --', {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: '#8be28b',
      })
      .setOrigin(0, 0);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }

  override update(_time: number, delta: number): void {
    this.fpsTimer += delta;
    if (this.fpsTimer >= FPS_UPDATE_MS) {
      this.fpsTimer = 0;
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.title.setPosition(gameSize.width / 2, gameSize.height / 2);
  }
}
