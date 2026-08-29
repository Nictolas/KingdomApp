import Phaser from "phaser";

import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import type { MapSceneBridge, PhaserMapSnapshot } from "../adapters/mapSceneBridge";

const SHEET_KEY = "overworld";
const TILE_LAYER_DEPTH = 0;

function frameKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export class KingdomMapScene extends Phaser.Scene {
  private readonly bridge: MapSceneBridge;
  private readonly sheetUrl: string;
  private unsubscribe: (() => void) | null = null;
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private renderedRevision = -1;
  private waterSprites: Phaser.GameObjects.Image[] = [];
  private waterFrame = 0;
  private nextWaterFrameAt = 0;
  private dragPointerId: number | null = null;
  private dragged = false;

  constructor(bridge: MapSceneBridge, sheetUrl: string) {
    super({ key: "kingdom-map" });
    this.bridge = bridge;
    this.sheetUrl = sheetUrl;
  }

  preload(): void {
    this.load.image(SHEET_KEY, this.sheetUrl);
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0).setDepth(TILE_LAYER_DEPTH);
    this.configureTextureFrames(this.bridge.getSnapshot());
    this.renderSnapshot(this.bridge.getSnapshot());
    this.configureCameraAndInput();
    this.unsubscribe = this.bridge.subscribe(() => {
      const snapshot = this.bridge.getSnapshot();
      if (snapshot.revision !== this.renderedRevision) this.renderSnapshot(snapshot);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private configureTextureFrames(snapshot: PhaserMapSnapshot): void {
    const texture = this.textures.get(SHEET_KEY);
    for (let frame = 0; frame < OVERWORLD_SHEET_PX.waterFrames; frame++) {
      const x = OVERWORLD_SHEET_PX.waterAnimX + frame * OVERWORLD_SHEET_PX.tile;
      const key = frameKey(x, OVERWORLD_SHEET_PX.waterAnimY);
      if (!texture.has(key)) {
        texture.add(key, 0, x, OVERWORLD_SHEET_PX.waterAnimY, OVERWORLD_SHEET_PX.tile, OVERWORLD_SHEET_PX.tile);
      }
    }
    for (const tile of snapshot.tiles) {
      const key = frameKey(tile.frameX, tile.frameY);
      if (!texture.has(key)) {
        texture.add(
          key,
          0,
          tile.frameX,
          tile.frameY,
          OVERWORLD_SHEET_PX.tile,
          OVERWORLD_SHEET_PX.tile
        );
      }
      if (tile.overlayFrameX != null && tile.overlayFrameY != null) {
        const overlayKey = frameKey(tile.overlayFrameX, tile.overlayFrameY);
        if (!texture.has(overlayKey)) {
          texture.add(
            overlayKey,
            0,
            tile.overlayFrameX,
            tile.overlayFrameY,
            OVERWORLD_SHEET_PX.tile,
            OVERWORLD_SHEET_PX.tile
          );
        }
      }
    }
  }

  private renderSnapshot(snapshot: PhaserMapSnapshot): void {
    if (!this.tileLayer) return;
    this.configureTextureFrames(snapshot);
    this.tileLayer.removeAll(true);
    this.waterSprites = [];

    const bleed = 1;
    for (const tile of snapshot.tiles) {
      const col = tile.index % snapshot.cols;
      const row = Math.floor(tile.index / snapshot.cols);
      const sprite = this.add
        .image(
          col * snapshot.cellSize + snapshot.cellSize / 2,
          row * snapshot.cellSize + snapshot.cellSize / 2,
          SHEET_KEY,
          frameKey(tile.frameX, tile.frameY)
        )
        .setDisplaySize(snapshot.cellSize + bleed, snapshot.cellSize + bleed);
      this.tileLayer.add(sprite);
      if (tile.animation === "water") this.waterSprites.push(sprite);
      if (tile.overlayFrameX != null && tile.overlayFrameY != null) {
        const overlay = this.add
          .image(
            col * snapshot.cellSize + snapshot.cellSize / 2,
            row * snapshot.cellSize + snapshot.cellSize / 2,
            SHEET_KEY,
            frameKey(tile.overlayFrameX, tile.overlayFrameY)
          )
          .setDisplaySize(snapshot.cellSize, snapshot.cellSize);
        this.tileLayer.add(overlay);
      }
    }

    const worldW = snapshot.cols * snapshot.cellSize;
    const worldH = snapshot.rows * snapshot.cellSize;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics?.world?.setBounds(0, 0, worldW, worldH);
    this.renderedRevision = snapshot.revision;
  }

  update(time: number): void {
    if (time < this.nextWaterFrameAt || this.waterSprites.length === 0) return;
    this.nextWaterFrameAt = time + 420;
    this.waterFrame = (this.waterFrame + 1) % OVERWORLD_SHEET_PX.waterFrames;
    const key = frameKey(
      OVERWORLD_SHEET_PX.waterAnimX + this.waterFrame * OVERWORLD_SHEET_PX.tile,
      OVERWORLD_SHEET_PX.waterAnimY
    );
    for (const sprite of this.waterSprites) sprite.setFrame(key);
  }

  private configureCameraAndInput(): void {
    const camera = this.cameras.main;
    camera.setRoundPixels(true);
    camera.setZoom(1);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.dragPointerId = pointer.id;
      this.dragged = false;
      this.bridge.setDragging(true);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.dragPointerId || !pointer.isDown) return;
      if (Math.abs(pointer.velocity.x) + Math.abs(pointer.velocity.y) > 2) this.dragged = true;
      camera.scrollX -= pointer.velocity.x / camera.zoom;
      camera.scrollY -= pointer.velocity.y / camera.zoom;
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.dragPointerId) return;
      this.dragPointerId = null;
      this.bridge.setDragging(false);
      if (this.dragged) return;

      const snapshot = this.bridge.getSnapshot();
      const world = camera.getWorldPoint(pointer.x, pointer.y);
      const col = Math.floor(world.x / snapshot.cellSize);
      const row = Math.floor(world.y / snapshot.cellSize);
      if (col < 0 || col >= snapshot.cols || row < 0 || row >= snapshot.rows) return;
      this.bridge.pressCell(row * snapshot.cols + col);
    });

    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const before = camera.getWorldPoint(pointer.x, pointer.y);
        const nextZoom = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 3);
        camera.setZoom(nextZoom);
        const after = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += before.x - after.x;
        camera.scrollY += before.y - after.y;
      }
    );
  }
}
