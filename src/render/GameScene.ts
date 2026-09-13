import Phaser from 'phaser';
import type { Command, Dir8, EntityId, TileKind, Tree, Unit, World } from '../sim';
import { DIR_VECTORS, TICK_MS, generateWorld, moveCmd, step } from '../sim';
import { ATLAS_KEY } from './BootScene';
import { animKey } from './facing';
import { HALF_TILE_H, HALF_TILE_W, depthFor, gridToScreen, mapBounds } from './iso';
import { Hud } from './Hud';
import { Joystick } from '../input/joystick';
import { readSeed } from './params';

/** Teren jest jedną statyczną teksturą — zawsze pod wszystkim. */
const DEPTH_GROUND = -1000;
/** Cień leży tuż pod jednostką (ta sama pozycja, mniejszy depth). */
const SHADOW_DEPTH_BIAS = -0.5;
/** Zakładka w tle potrafi oddać kilkusekundową `delta` — nie nadganiamy więcej niż tyle. */
const MAX_DELTA_MS = 250;
/** Wyprzedzenie kamery w kierunku ruchu (px ekranowe, przestrzeń świata). */
const LOOKAHEAD_PX = 12;
const LOOKAHEAD_MS = 300;
/** Zoom 3 na większych ekranach, 2 na telefonie — zawsze całkowity (pixel art). */
const ZOOM_LARGE = 3;
const ZOOM_SMALL = 2;
const ZOOM_LARGE_MIN_SIDE = 700;
const HUD_UPDATE_MS = 250;

/** `TileKind` -> nazwa klatki w atlasie. */
const FALLBACK_TILE_FRAME = 'tile_grass0';
const TILE_FRAMES: readonly string[] = [
  'tile_grass0',
  'tile_grass1',
  'tile_grass2',
  'tile_dirt',
  'tile_water',
];

const TREE_FRAMES: Record<Tree['state'], string> = {
  full: 'tree_full',
  chopped: 'tree_chopped',
  stump: 'tree_stump',
};

interface UnitView {
  unit: Unit;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  prevX: number;
  prevY: number;
  anim: string;
}

export function zoomFor(width: number, height: number): number {
  return Math.min(width, height) >= ZOOM_LARGE_MIN_SIDE ? ZOOM_LARGE : ZOOM_SMALL;
}

/**
 * Scena rozgrywki (Faza 1): świat z seeda, teren jako jedna `RenderTexture`, drzewa jako
 * statyczne obrazy, jednostki jako sprite'y interpolowane między tickami symulacji.
 *
 * Pętla: akumulator czasu -> `step(world, commands)` co 50 ms; render rysuje stan
 * pośredni (`alpha = acc / TICK_MS`), więc ruch jest płynny mimo 20 Hz symulacji.
 */
export class GameScene extends Phaser.Scene {
  private seed = 0;
  private world!: World;
  private hud!: Hud;
  private joystick!: Joystick;
  private hudCamera!: Phaser.Cameras.Scene2D.Camera;

  private readonly views = new Map<EntityId, UnitView>();
  private player!: UnitView;

  private acc = 0;
  private hudTimer = 0;
  /** Ostatni kierunek wysłany do symulacji — żeby wysłać `null` dokładnie raz po puszczeniu. */
  private lastSentDir: Dir8 | null = null;
  private lookaheadDir: Dir8 | null = null;
  private lookaheadTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = readSeed();
    this.world = generateWorld(this.seed);

    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    worldObjects.push(this.buildTerrain());
    worldObjects.push(...this.buildTrees());
    for (const unit of this.world.units) {
      const view = this.buildUnitView(unit);
      this.views.set(unit.id, view);
      worldObjects.push(view.shadow, view.sprite);
    }
    const player = [...this.views.values()].find((v) => v.unit.kind === 'worker');
    if (!player) throw new Error('GameScene: świat bez robotnika');
    this.player = player;

    this.setupCameras(worldObjects);
    this.renderUnits(1);
    this.exposeDebugHandle();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.hud.destroy();
    });
  }

  /**
   * Uchwyt debugowy dla testów e2e (Playwright) i konsoli przeglądarki:
   * `window.nightfall.snapshot()` zwraca tick, pozycję jednostki i bieżącą klatkę animacji.
   * Świadomie dostępny też w buildzie produkcyjnym — to jedyny sposób, żeby skrypt
   * testowy odczytał stan gry z canvasu bez OCR-owania HUD-u.
   */
  private exposeDebugHandle(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as { nightfall?: unknown }).nightfall = {
      scene: this,
      snapshot: (): Record<string, unknown> => ({
        tick: this.world.tick,
        seed: this.seed,
        gx: this.player.unit.pos.x,
        gy: this.player.unit.pos.y,
        facing: this.player.unit.facing,
        moving: this.player.unit.moving,
        anim: this.player.sprite.anims.currentAnim?.key ?? null,
        frame: this.player.sprite.anims.currentFrame?.textureFrame ?? null,
        fps: this.game.loop.actualFps,
        joystick: this.joystick.active,
        trees: this.world.trees.length,
        zoom: this.cameras.main.zoom,
      }),
    };
  }

  // ——— Budowa sceny ———

  /**
   * Cały teren rysowany RAZ do `RenderTexture` (4096 kafli jako jedna tekstura):
   * zero kosztu sortowania i renderowania per kafel w każdej klatce.
   * Tekstura jest kotwiczona w lewym górnym rogu bounding boxa mapy, którego x jest
   * ujemny (skrajny kafel to (0, MAP_H) -> screenX = -MAP_H * 16).
   */
  private buildTerrain(): Phaser.GameObjects.RenderTexture {
    const bounds = mapBounds(this.world.width, this.world.height);
    const rt = this.add
      .renderTexture(bounds.x, bounds.y, bounds.width, bounds.height)
      .setOrigin(0, 0)
      .setDepth(DEPTH_GROUND);

    rt.beginDraw();
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        const kind = (this.world.tiles[y * this.world.width + x] ?? 0) as TileKind;
        const frame = TILE_FRAMES[kind] ?? FALLBACK_TILE_FRAME;
        const center = gridToScreen(x + 0.5, y + 0.5);
        rt.batchDrawFrame(
          ATLAS_KEY,
          frame,
          center.x - bounds.x - HALF_TILE_W,
          center.y - bounds.y - HALF_TILE_H,
        );
      }
    }
    rt.endDraw();
    return rt;
  }

  /** Drzewa: jeden `Image` na drzewo, depth ustawiony RAZ (drzewa się nie ruszają). */
  private buildTrees(): Phaser.GameObjects.Image[] {
    const images: Phaser.GameObjects.Image[] = [];
    for (const tree of this.world.trees) {
      const gx = tree.x + 0.5;
      const gy = tree.y + 0.5;
      const p = gridToScreen(gx, gy);
      images.push(
        this.add
          .image(p.x, p.y, ATLAS_KEY, TREE_FRAMES[tree.state])
          .setOrigin(0.5, 1)
          .setDepth(depthFor(gx, gy)),
      );
    }
    return images;
  }

  private buildUnitView(unit: Unit): UnitView {
    const p = gridToScreen(unit.pos.x, unit.pos.y);
    const shadow = this.add.image(p.x, p.y, ATLAS_KEY, 'shadow').setOrigin(0.5, 0.5);
    const anim = animKey(unit.kind, unit.moving, unit.facing);
    const sprite = this.add.sprite(p.x, p.y, ATLAS_KEY).setOrigin(0.5, 1);
    sprite.play(anim);
    return { unit, sprite, shadow, prevX: unit.pos.x, prevY: unit.pos.y, anim };
  }

  /**
   * Dwie kamery: świat (zoom całkowity, follow) i HUD (zoom 1, bez scrolla).
   * Każda ignoruje obiekty tej drugiej — inaczej zoom kamery świata rozjechałby HUD.
   */
  private setupCameras(worldObjects: Phaser.GameObjects.GameObject[]): void {
    const { width, height } = this.scale.gameSize;
    const bounds = mapBounds(this.world.width, this.world.height);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0c14');
    cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    cam.setZoom(zoomFor(width, height));
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setFollowOffset(0, 0);

    this.hudCamera = this.cameras.add(0, 0, width, height);
    this.hudCamera.setName('hud');

    this.hud = new Hud(this);
    this.joystick = new Joystick(this);

    const hudObjects: Phaser.GameObjects.GameObject[] = [...this.hud.objects, this.joystick.graphics];
    cam.ignore(hudObjects);
    this.hudCamera.ignore(worldObjects);
  }

  // ——— Pętla ———

  override update(_time: number, delta: number): void {
    this.acc += Math.min(delta, MAX_DELTA_MS);
    while (this.acc >= TICK_MS) {
      this.stepOnce();
      this.acc -= TICK_MS;
    }

    const alpha = this.acc / TICK_MS;
    this.renderUnits(alpha);
    this.joystick.draw();

    this.hudTimer += delta;
    if (this.hudTimer >= HUD_UPDATE_MS) {
      this.hudTimer = 0;
      this.hud.update({
        fps: this.game.loop.actualFps,
        tick: this.world.tick,
        seed: this.seed,
        gx: this.player.unit.pos.x,
        gy: this.player.unit.pos.y,
      });
    }
  }

  /** Jeden tick symulacji: komendy z wejścia -> `step`. */
  private stepOnce(): void {
    for (const view of this.views.values()) {
      view.prevX = view.unit.pos.x;
      view.prevY = view.unit.pos.y;
    }

    const dir = this.joystick.getDir();
    const commands: Command[] = [];
    // Komenda `move` co tick: bieżący kierunek albo dokładnie jeden `null` po puszczeniu.
    if (dir !== null) commands.push(moveCmd(this.player.unit.id, dir));
    else if (this.lastSentDir !== null) commands.push(moveCmd(this.player.unit.id, null));
    this.lastSentDir = dir;

    step(this.world, commands);
    this.updateLookahead(dir);
  }

  /** Pozycje interpolowane między tickami + depth i animacja per klatkę. */
  private renderUnits(alpha: number): void {
    for (const view of this.views.values()) {
      const gx = view.prevX + (view.unit.pos.x - view.prevX) * alpha;
      const gy = view.prevY + (view.unit.pos.y - view.prevY) * alpha;
      const p = gridToScreen(gx, gy);
      view.sprite.setPosition(p.x, p.y);
      view.shadow.setPosition(p.x, p.y);
      const depth = depthFor(gx, gy);
      view.sprite.setDepth(depth);
      view.shadow.setDepth(depth + SHADOW_DEPTH_BIAS);

      const key = animKey(view.unit.kind, view.unit.moving, view.unit.facing);
      if (key !== view.anim) {
        view.anim = key;
        view.sprite.play(key, true);
      }
    }
  }

  /**
   * Wyprzedzenie kamery: `followOffset` jest **odejmowany** od pozycji celu,
   * więc żeby patrzeć w stronę ruchu, offset idzie w przeciwną stronę.
   */
  private updateLookahead(dir: Dir8 | null): void {
    if (dir === this.lookaheadDir) return;
    this.lookaheadDir = dir;

    let x = 0;
    let y = 0;
    if (dir !== null) {
      const v = DIR_VECTORS[dir];
      const s = gridToScreen(v.x, v.y);
      const len = Math.hypot(s.x, s.y) || 1;
      x = (-s.x / len) * LOOKAHEAD_PX;
      y = (-s.y / len) * LOOKAHEAD_PX;
    }

    this.lookaheadTween?.stop();
    this.lookaheadTween = this.tweens.add({
      targets: this.cameras.main.followOffset,
      x,
      y,
      duration: LOOKAHEAD_MS,
      ease: 'Sine.easeOut',
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const { width, height } = gameSize;
    this.cameras.resize(width, height);
    this.cameras.main.setZoom(zoomFor(width, height));
    this.hudCamera.setZoom(1);
    this.hud.resize();
  }
}
