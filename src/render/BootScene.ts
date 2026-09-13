import Phaser from 'phaser';
import type { FrameDir } from './facing';

/** Klucz tekstury atlasu — ten sam dla wszystkich scen. */
export const ATLAS_KEY = 'atlas';

/** Kierunki narysowane w atlasie (kolejność bez znaczenia — tworzymy animacje dla wszystkich). */
const FRAME_DIRS: readonly FrameDir[] = ['ne', 'se', 'sw', 'nw'];

const WALK_FPS = 8;
const WALK_FRAMES = 4;
const IDLE_FPS = 2;
const IDLE_FRAMES = 2;

/**
 * Faza 1: ładuje atlas, rejestruje animacje robotnika i oddaje scenę `GameScene`.
 * Paska ładowania nie ma — atlas to ~2 kB i jeden request.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Ścieżki względne: Vite serwuje `assets/build` jako publicDir, a `base: './'`
    // pozwala hostować grę w podkatalogu (GitHub Pages).
    this.load.atlas(ATLAS_KEY, 'atlas.png', 'atlas.json');
  }

  create(): void {
    this.createUnitAnims('worker');
    this.scene.start('Game');
  }

  /** `{kind}_walk_{dir}` (4 klatki, 8 fps) i `{kind}_idle_{dir}` (2 klatki, 2 fps). */
  private createUnitAnims(kind: string): void {
    for (const dir of FRAME_DIRS) {
      this.anims.create({
        key: `${kind}_walk_${dir}`,
        frames: this.anims.generateFrameNames(ATLAS_KEY, {
          prefix: `${kind}_walk_${dir}_`,
          start: 0,
          end: WALK_FRAMES - 1,
        }),
        frameRate: WALK_FPS,
        repeat: -1,
      });
      this.anims.create({
        key: `${kind}_idle_${dir}`,
        frames: this.anims.generateFrameNames(ATLAS_KEY, {
          prefix: `${kind}_idle_${dir}_`,
          start: 0,
          end: IDLE_FRAMES - 1,
        }),
        frameRate: IDLE_FPS,
        repeat: -1,
      });
    }
  }
}
