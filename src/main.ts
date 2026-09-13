import Phaser from 'phaser';
import { BootScene } from './render/BootScene';
import { registerServiceWorker } from './pwa/register-sw';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0b0c14',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene],
};

export const game = new Phaser.Game(config);

registerServiceWorker();
