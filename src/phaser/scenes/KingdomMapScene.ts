import Phaser from "phaser";

import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import type { MapSceneBridge, PhaserMapSnapshot } from "../adapters/mapSceneBridge";

const SHEET_KEY = "overworld";
const TILE_LAYER_DEPTH = 0;
const BUILDING_LAYER_DEPTH = 10;

const BUILDING_COLORS = {
  residence: { fill: 0xb45309, roof: 0xf59e0b, border: 0x451a03 },
  industry: { fill: 0x475569, roof: 0x94a3b8, border: 0x0f172a },
  service: { fill: 0x1d4ed8, roof: 0x60a5fa, border: 0x172554 },
  security: { fill: 0x991b1b, roof: 0xef4444, border: 0x450a0a },
  religion: { fill: 0x7e22ce, roof: 0xc084fc, border: 0x3b0764 },
  special: { fill: 0x0f766e, roof: 0x2dd4bf, border: 0x042f2e }
} as const;

function frameKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export class KingdomMapScene extends Phaser.Scene {
  private readonly bridge: MapSceneBridge;
  private readonly sheetUrl: string;
  private unsubscribe: (() => void) | null = null;
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private buildingLayer: Phaser.GameObjects.Container | null = null;
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
    this.buildingLayer = this.add.container(0, 0).setDepth(BUILDING_LAYER_DEPTH);
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
    this.renderBuildings(snapshot);
  }

  private renderBuildings(snapshot: PhaserMapSnapshot): void {
    if (!this.buildingLayer) return;
    this.buildingLayer.removeAll(true);

    for (const building of snapshot.buildings) {
      const col = building.anchor % snapshot.cols;
      const row = Math.floor(building.anchor / snapshot.cols);
      const x = col * snapshot.cellSize;
      const y = row * snapshot.cellSize;
      const width = building.widthCells * snapshot.cellSize;
      const height = building.heightCells * snapshot.cellSize;
      const colors = BUILDING_COLORS[building.category];
      const group = this.add.container(x, y);

      const shadow = this.add
        .rectangle(width / 2 + 3, height / 2 + 4, width - 5, height - 5, 0x000000, 0.28)
        .setOrigin(0.5);
      const body = this.add
        .rectangle(width / 2, height / 2, width - 6, height - 8, colors.fill, 1)
        .setStrokeStyle(2, colors.border, 1);
      const roof = this.add
        .rectangle(width / 2, Math.max(7, height * 0.2), width - 3, Math.max(10, height * 0.32), colors.roof, 1)
        .setStrokeStyle(2, colors.border, 1);
      const emoji = this.add
        .text(width / 2, height / 2, building.emoji, {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.max(18, Math.min(34, snapshot.cellSize * 0.72))}px`
        })
        .setOrigin(0.5);
      const label = this.add
        .text(width / 2, height - 5, building.name, {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.max(8, Math.min(11, snapshot.cellSize * 0.24))}px`,
          color: "#ffffff",
          backgroundColor: "rgba(2,6,23,0.72)",
          padding: { x: 3, y: 1 }
        })
        .setOrigin(0.5, 1);

      group.add([shadow, body, roof, emoji, label]);
      this.buildingLayer.add(group);
    }
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
      const dx = pointer.x - pointer.prevPosition.x;
      const dy = pointer.y - pointer.prevPosition.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
      camera.scrollX -= dx / camera.zoom;
      camera.scrollY -= dy / camera.zoom;
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
