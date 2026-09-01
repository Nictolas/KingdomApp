import Phaser from "phaser";

import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import type { MapSceneBridge, PhaserMapBuilding, PhaserMapCharacter, PhaserMapSnapshot } from "../adapters/mapSceneBridge";
import { LPC_DIRECTION_ROWS } from "../../character-system/lpcPack";
import { canRenderCharacter, resolveCharacterLayers } from "../../character-system/registry";
import { scrollKeepingPointerAnchor } from "../../game/pointerZoom";

const SHEET_KEY = "overworld";
const HUMAN_KEY = "human-colonist";
const GOLEM_KEY = "stone-golem";
const LPC_IDLE_KEY = "lpc-human-male-idle";
const LPC_WALK_KEY = "lpc-human-male-walk";
const TILE_LAYER_DEPTH = 0;
const INTERACTION_LAYER_DEPTH = 30;
const WORLD_DEPTH_BASE = 100;

export function worldDepthForY(y: number): number {
  return WORLD_DEPTH_BASE + Math.round(y * 10);
}

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

export type PhaserArtAssetUrls = {
  human: string;
  golem: string;
  lpcHumanMaleIdle: string;
  lpcHumanMaleWalk: string;
  lpcLayers: Record<string, string>;
  buildings: Record<
    NonNullable<PhaserMapBuilding["artKey"]>,
    string | { base: string; overlay?: string; doorway?: string }
  >;
};

type CharacterView = {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  sprites: Phaser.GameObjects.Sprite[];
  token: number;
  direction: 0 | 1 | 2 | 3;
  usesLpc: boolean;
};

export class KingdomMapScene extends Phaser.Scene {
  private readonly bridge: MapSceneBridge;
  private readonly sheetUrl: string;
  private readonly artUrls: PhaserArtAssetUrls;
  private unsubscribe: (() => void) | null = null;
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private worldLayer: Phaser.GameObjects.Container | null = null;
  private buildingViews: Phaser.GameObjects.Container[] = [];
  private buildingDebugLayer: Phaser.GameObjects.Container | null = null;
  private interactionLayer: Phaser.GameObjects.Container | null = null;
  private gridLayer: Phaser.GameObjects.Graphics | null = null;
  private readonly characterViews = new Map<number, CharacterView>();
  private renderedRevision = -1;
  private waterSprites: Phaser.GameObjects.Image[] = [];
  private waterFrame = 0;
  private nextWaterFrameAt = 0;
  private dragPointerId: number | null = null;
  private dragged = false;
  private hoveredCell: number | null = null;
  private readonly characterLastPressAt = new Map<number, number>();

  constructor(bridge: MapSceneBridge, sheetUrl: string, artUrls: PhaserArtAssetUrls) {
    super({ key: "kingdom-map" });
    this.bridge = bridge;
    this.sheetUrl = sheetUrl;
    this.artUrls = artUrls;
  }

  preload(): void {
    this.load.image(SHEET_KEY, this.sheetUrl);
    this.load.spritesheet(HUMAN_KEY, this.artUrls.human, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(GOLEM_KEY, this.artUrls.golem, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(LPC_IDLE_KEY, this.artUrls.lpcHumanMaleIdle, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(LPC_WALK_KEY, this.artUrls.lpcHumanMaleWalk, { frameWidth: 64, frameHeight: 64 });
    for (const [key, url] of Object.entries(this.artUrls.lpcLayers)) {
      this.load.spritesheet(key, url, { frameWidth: 64, frameHeight: 64 });
    }
    for (const [key, asset] of Object.entries(this.artUrls.buildings)) {
      if (typeof asset === "string") this.load.image(key, asset);
      else {
        this.load.image(key, asset.base);
        if (asset.overlay) this.load.image(`${key}-overlay`, asset.overlay);
        if (asset.doorway) this.load.image(`${key}-doorway`, asset.doorway);
      }
    }
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0).setDepth(TILE_LAYER_DEPTH);
    this.worldLayer = this.add.container(0, 0).setDepth(10);
    this.buildingDebugLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH - 1);
    this.interactionLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH);
    this.gridLayer = this.add.graphics().setDepth(INTERACTION_LAYER_DEPTH - 1);
    this.configureCharacterAnimations();
    this.configureTextureFrames(this.bridge.getSnapshot());
    this.renderSnapshot(this.bridge.getSnapshot());
    this.configureCameraAndInput();
    this.unsubscribe = this.bridge.subscribe(() => {
      const snapshot = this.bridge.getSnapshot();
      if (snapshot.revision !== this.renderedRevision) this.renderSnapshot(snapshot);
      else {
        this.reconcileCharacters(snapshot);
        this.renderGrid(snapshot);
        this.renderInteraction(snapshot);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private configureCharacterAnimations(): void {
    for (const texture of [HUMAN_KEY, GOLEM_KEY]) {
      for (const [name, direction] of [["down", 0], ["left", 1], ["right", 2], ["up", 3]] as const) {
        this.anims.create({
          key: `${texture}-walk-${name}`,
          frames: [direction, 4 + direction, 8 + direction, 4 + direction].map((frame) => ({ key: texture, frame })),
          frameRate: 8,
          repeat: -1
        });
      }
    }
    for (const name of ["down", "left", "right", "up"] as const) {
      const row = LPC_DIRECTION_ROWS[name];
      this.anims.create({
        key: `${LPC_WALK_KEY}-walk-${name}`,
        frames: Array.from({ length: 9 }, (_, column) => ({ key: LPC_WALK_KEY, frame: row * 13 + column })),
        frameRate: 10,
        repeat: -1
      });
      this.anims.create({
        key: `${LPC_IDLE_KEY}-idle-${name}`,
        frames: [0, 1].map((column) => ({ key: LPC_IDLE_KEY, frame: row * 13 + column })),
        frameRate: 2,
        repeat: -1
      });
    }
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
    this.reconcileCharacters(snapshot);
    this.renderGrid(snapshot);
    this.renderInteraction(snapshot);
  }

  private renderGrid(snapshot: PhaserMapSnapshot): void {
    if (!this.gridLayer) return;
    this.gridLayer.clear();
    if (!snapshot.showGrid) return;
    this.gridLayer.lineStyle(1, 0x0f172a, 0.24);
    const width = snapshot.cols * snapshot.cellSize;
    const height = snapshot.rows * snapshot.cellSize;
    for (let col = 0; col <= snapshot.cols; col++) {
      const x = col * snapshot.cellSize;
      this.gridLayer.lineBetween(x, 0, x, height);
    }
    for (let row = 0; row <= snapshot.rows; row++) {
      const y = row * snapshot.cellSize;
      this.gridLayer.lineBetween(0, y, width, y);
    }
  }

  private renderInteraction(snapshot: PhaserMapSnapshot): void {
    if (!this.interactionLayer) return;
    this.interactionLayer.removeAll(true);
    const interaction = snapshot.interaction;
    if (!interaction || interaction.mode !== "build" || interaction.hoverCell == null) return;

    const color = interaction.valid ? 0x22c55e : 0xef4444;
    for (const cell of interaction.affectedCells) {
      const col = cell % snapshot.cols;
      const row = Math.floor(cell / snapshot.cols);
      const marker = this.add.rectangle(
        col * snapshot.cellSize + snapshot.cellSize / 2,
        row * snapshot.cellSize + snapshot.cellSize / 2,
        snapshot.cellSize - 3,
        snapshot.cellSize - 3,
        color,
        0.32
      ).setStrokeStyle(2, color, 0.95);
      this.interactionLayer.add(marker);
    }
  }

  private reconcileCharacters(snapshot: PhaserMapSnapshot): void {
    if (!this.worldLayer) return;
    const active = new Set(snapshot.characters.map((character) => character.id));
    for (const [id, view] of this.characterViews) {
      if (active.has(id)) continue;
      view.root.destroy(true);
      this.characterViews.delete(id);
    }

    for (const character of snapshot.characters) {
      const token = character.pathToken ?? 0;
      let view = this.characterViews.get(character.id);
      if (!view) {
        const root = this.add.container(0, 0);
        const usesLpc = character.characterAppearance != null && canRenderCharacter(character.characterAppearance, "idle");
        const texture = usesLpc ? LPC_IDLE_KEY : character.appearance === "golem" ? GOLEM_KEY : HUMAN_KEY;
        const initialFrame = usesLpc ? LPC_DIRECTION_ROWS.down * 2 : 0;
        const sprite = this.add.sprite(0, -snapshot.cellSize * 0.2, texture, initialFrame)
          .setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08);
        const sprites = usesLpc && character.characterAppearance
          ? resolveCharacterLayers(character.characterAppearance, "idle").map((layer) => this.add
              .sprite(0, -snapshot.cellSize * 0.2, layer.sourceId, initialFrame)
              .setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08))
          : [sprite];
        if (usesLpc) sprite.setVisible(false);
        if (!character.appearance && character.markerEmoji) {
          sprite.setVisible(false);
          root.add(this.add.text(0, -snapshot.cellSize * 0.2, character.markerEmoji, { fontSize: "26px" }).setOrigin(0.5));
        }
        root.add(sprites);
        root.add(this.add.text(0, snapshot.cellSize * 0.34, character.name, {
          fontSize: "9px", color: "#ffffff", backgroundColor: "rgba(2,6,23,0.7)", padding: { x: 2, y: 1 }
        }).setOrigin(0.5));
        this.worldLayer.add(root);
        root.setSize(snapshot.cellSize, snapshot.cellSize).setInteractive();
        root.on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          const now = this.time.now;
          const last = this.characterLastPressAt.get(character.id) ?? 0;
          const doublePress = now - last < 340;
          this.characterLastPressAt.set(character.id, now);
          this.bridge.pressCharacter(character.id, doublePress);
        });
        view = { root, sprite, sprites, token: -1, direction: 0, usesLpc };
        this.characterViews.set(character.id, view);
      }
      if (view.token === token) continue;
      this.tweens.killTweensOf(view.root);
      const start = character.path?.[0] ?? character.cell;
      const finalPathCell = character.path?.[(character.path?.length ?? 0) - 1];
      const enteringBuilding = snapshot.buildings.find((building) => finalPathCell === building.geometry.entryPoint.cell);
      const exitingBuilding = snapshot.buildings.find((building) => {
        const f = building.geometry.footprint;
        const c = character.cell % snapshot.cols;
        const r = Math.floor(character.cell / snapshot.cols);
        return character.path?.[0] === building.geometry.entryPoint.cell && c >= f.col && c < f.col + f.width && r >= f.row && r < f.row + f.height;
      });
      if (exitingBuilding) {
        view.root.setPosition(
          exitingBuilding.geometry.interiorSpawnPoint.x * snapshot.cellSize,
          exitingBuilding.geometry.interiorSpawnPoint.y * snapshot.cellSize
        );
        this.updateCharacterDepth(view.root);
      } else this.placeCharacter(view.root, start, snapshot);
      view.token = token;
      const path = character.path?.slice(1) ?? [];
      const waypoints = path.map((cell) => ({ ...this.characterPosition(cell, snapshot), cell }));
      if (exitingBuilding) {
        waypoints.unshift({
          x: (exitingBuilding.geometry.doorway.col + exitingBuilding.geometry.doorway.width / 2) * snapshot.cellSize,
          y: (exitingBuilding.geometry.doorway.row + 0.92) * snapshot.cellSize,
          cell: exitingBuilding.geometry.doorCell
        });
      }
      if (enteringBuilding) {
        waypoints.push(
          {
            x: (enteringBuilding.geometry.doorway.col + enteringBuilding.geometry.doorway.width / 2) * snapshot.cellSize,
            y: (enteringBuilding.geometry.doorway.row + 0.92) * snapshot.cellSize,
            cell: enteringBuilding.geometry.doorCell
          },
          {
            x: enteringBuilding.geometry.interiorSpawnPoint.x * snapshot.cellSize,
            y: enteringBuilding.geometry.interiorSpawnPoint.y * snapshot.cellSize,
            cell: enteringBuilding.geometry.doorCell
          }
        );
      }
      if (waypoints.length > 0) {
        const animatedView = view;
        let currentCell = start;
        const moveNext = (index: number) => {
          if (index >= waypoints.length) {
            if (animatedView.usesLpc) {
              const directionName = this.directionName(animatedView.direction);
              const layers = character.characterAppearance ? resolveCharacterLayers(character.characterAppearance, "idle") : [];
              animatedView.sprites.forEach((layerSprite, layerIndex) => {
                const layer = layers[layerIndex];
                if (!layer) return layerSprite.setVisible(false);
                layerSprite.stop().setVisible(true).setTexture(layer.sourceId).setFrame(LPC_DIRECTION_ROWS[directionName] * 2);
              });
            } else animatedView.sprite.stop().setFrame(animatedView.direction);
            this.bridge.completeCharacterPath(character.id, token);
            return;
          }
          const waypoint = waypoints[index]!;
          if (waypoint.cell !== currentCell && !this.bridge.attemptCharacterStep(character.id, currentCell, waypoint.cell)) {
            this.stopCharacterAnimation(animatedView, character);
            this.bridge.blockCharacterPath(character.id, currentCell, waypoint.cell);
            return;
          }
          const direction = this.directionForStep(currentCell, waypoint.cell, snapshot.cols, animatedView.direction);
          const nextCell = waypoint.cell;
          const tween = this.tweens.add({
              targets: animatedView.root,
              x: waypoint.x,
              y: waypoint.y,
              duration: 320,
              ease: "Linear",
              onUpdate: () => this.updateCharacterDepth(animatedView.root),
              onStart: () => {
                const directionName = this.directionName(direction);
                if (animatedView.usesLpc && character.characterAppearance) {
                  const layers = resolveCharacterLayers(character.characterAppearance, "walk");
                  animatedView.sprites.forEach((layerSprite, layerIndex) => {
                    const layer = layers[layerIndex];
                    if (!layer) return layerSprite.setVisible(false);
                    layerSprite.setVisible(true).setTexture(layer.sourceId);
                    const row = LPC_DIRECTION_ROWS[directionName];
                    const animationKey = `${layer.sourceId}-walk-${directionName}`;
                    if (!this.anims.exists(animationKey)) this.anims.create({ key: animationKey, frames: Array.from({ length: 9 }, (_, column) => ({ key: layer.sourceId, frame: row * 9 + column })), frameRate: 10, repeat: -1 });
                    layerSprite.play(animationKey, true);
                  });
                }
                else animatedView.sprite.play(`${animatedView.sprite.texture.key}-walk-${directionName}`, true);
                animatedView.direction = direction;
              },
              onComplete: () => {
                currentCell = nextCell;
                moveNext(index + 1);
              }
          });
          void tween;
        };
        moveNext(0);
      }
    }
    this.worldLayer.sort("depth");
  }

  private directionForStep(from: number, to: number, cols: number, fallback: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
    const fromCol = from % cols;
    const toCol = to % cols;
    const fromRow = Math.floor(from / cols);
    const toRow = Math.floor(to / cols);
    if (toCol < fromCol) return 1;
    if (toCol > fromCol) return 2;
    if (toRow < fromRow) return 3;
    if (toRow > fromRow) return 0;
    return fallback;
  }

  private stopCharacterAnimation(view: CharacterView, character: PhaserMapCharacter): void {
    if (view.usesLpc) {
      const directionName = this.directionName(view.direction);
      const layers = character.characterAppearance ? resolveCharacterLayers(character.characterAppearance, "idle") : [];
      view.sprites.forEach((sprite, index) => {
        const layer = layers[index];
        if (!layer) return sprite.setVisible(false);
        sprite.stop().setVisible(true).setTexture(layer.sourceId).setFrame(LPC_DIRECTION_ROWS[directionName] * 2);
      });
    } else view.sprite.stop().setFrame(view.direction);
  }

  private directionName(direction: 0 | 1 | 2 | 3): "down" | "left" | "right" | "up" {
    return (["down", "left", "right", "up"] as const)[direction];
  }

  private characterPosition(cell: number, snapshot: PhaserMapSnapshot): { x: number; y: number } {
    return {
      x: (cell % snapshot.cols) * snapshot.cellSize + snapshot.cellSize / 2,
      y: Math.floor(cell / snapshot.cols) * snapshot.cellSize + snapshot.cellSize / 2
    };
  }

  private placeCharacter(root: Phaser.GameObjects.Container, cell: number, snapshot: PhaserMapSnapshot): void {
    const pos = this.characterPosition(cell, snapshot);
    root.setPosition(pos.x, pos.y);
    this.updateCharacterDepth(root);
  }

  private updateCharacterDepth(root: Phaser.GameObjects.Container): void {
    root.setDepth(worldDepthForY(root.y));
    this.worldLayer?.sort("depth");
  }

  private renderBuildings(snapshot: PhaserMapSnapshot): void {
    if (!this.worldLayer) return;
    for (const view of this.buildingViews) view.destroy(true);
    this.buildingViews = [];
    this.buildingDebugLayer?.removeAll(true);

    for (const building of snapshot.buildings) {
      const col = building.anchor % snapshot.cols;
      const row = Math.floor(building.anchor / snapshot.cols);
      const x = col * snapshot.cellSize;
      const y = row * snapshot.cellSize;
      const width = building.widthCells * snapshot.cellSize;
      const height = building.heightCells * snapshot.cellSize;
      const colors = BUILDING_COLORS[building.category];
      const base = this.add.container(x, y).setDepth(worldDepthForY((row + 0.05) * snapshot.cellSize));
      const overlay = this.add.container(x, y).setDepth(worldDepthForY(building.geometry.depthOrigin.y * snapshot.cellSize));
      this.buildingViews.push(base, overlay);
      this.worldLayer.add([base, overlay]);

      if (building.artKey) {
        const image = this.add.image(width / 2, height, building.artKey).setOrigin(0.5, 1);
        const scale = Math.min((width * 1.12) / image.width, (height + snapshot.cellSize * 0.75) / image.height);
        image.setScale(scale);
        const shadow = this.add.ellipse(width / 2 + 2, height - 2, width * 0.82, snapshot.cellSize * 0.3, 0x000000, 0.25);
        const label = this.add.text(width / 2, height - 3, building.name, {
          fontFamily: "Arial, sans-serif", fontSize: `${Math.max(8, snapshot.cellSize * 0.22)}px`,
          color: "#ffffff", backgroundColor: "rgba(2,6,23,0.72)", padding: { x: 3, y: 1 }
        }).setOrigin(0.5, 1);
        const overlayKey = `${building.artKey}-overlay`;
        const hasDedicatedOverlay = this.textures.exists(overlayKey);
        const overlayImage = this.add.image(width / 2, height, hasDedicatedOverlay ? overlayKey : building.artKey).setOrigin(0.5, 1).setScale(scale);
        if (!hasDedicatedOverlay) {
          const source = overlayImage.texture.getSourceImage();
          overlayImage.setCrop(0, 0, source.width, source.height * 0.62);
        }
        base.add([shadow, image, label]);
        const doorwayKey = `${building.artKey}-doorway`;
        if (this.textures.exists(doorwayKey)) {
          base.add(this.add.image(
            (building.geometry.doorway.col - col + building.geometry.doorway.width / 2) * snapshot.cellSize,
            height,
            doorwayKey
          ).setOrigin(0.5, 1).setScale(scale));
        }
        overlay.add(overlayImage);
        this.renderBuildingDebug(building, snapshot);
        continue;
      }

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

      const door = this.add.rectangle(
        (building.geometry.doorway.col - col + building.geometry.doorway.width / 2) * snapshot.cellSize,
        height - snapshot.cellSize * 0.42,
        building.geometry.doorway.width * snapshot.cellSize,
        snapshot.cellSize * 0.84,
        0x111827,
        1
      ).setStrokeStyle(1, colors.border, 1);
      base.add([shadow, body, emoji, door, label]);
      overlay.add(roof);
      this.renderBuildingDebug(building, snapshot);
    }
    this.worldLayer.sort("depth");
  }

  private renderBuildingDebug(building: PhaserMapBuilding, snapshot: PhaserMapSnapshot): void {
    if (!snapshot.debugBuildings || !this.buildingDebugLayer) return;
    const g = this.add.graphics();
    const s = snapshot.cellSize;
    const rect = (area: { col: number; row: number; width: number; height: number }, color: number) => {
      g.lineStyle(2, color, 0.9).strokeRect(area.col * s, area.row * s, area.width * s, area.height * s);
    };
    rect(building.geometry.footprint, 0x22c55e);
    rect(building.geometry.doorway, 0x38bdf8);
    rect(building.geometry.overlayArea, 0xa855f7);
    for (const collision of building.geometry.collisionAreas) rect(collision, 0xef4444);
    g.fillStyle(0xfacc15, 1).fillCircle(building.geometry.entryPoint.x * s, building.geometry.entryPoint.y * s, 4);
    g.fillStyle(0xffffff, 1).fillCircle(building.geometry.depthOrigin.x * s, building.geometry.depthOrigin.y * s, 4);
    this.buildingDebugLayer.add(g);
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
      if (!pointer.isDown) {
        this.emitHoveredCell(pointer);
        return;
      }
      if (pointer.id !== this.dragPointerId) return;
      const dx = pointer.x - pointer.prevPosition.x;
      const dy = pointer.y - pointer.prevPosition.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
      camera.scrollX -= dx / camera.zoom;
      camera.scrollY -= dy / camera.zoom;
    });

    this.input.on("pointerout", () => {
      this.hoveredCell = null;
      this.bridge.hoverCell(null);
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
        if (nextZoom === camera.zoom) return;
        const nextScroll = scrollKeepingPointerAnchor(
          before,
          { x: pointer.x - camera.x, y: pointer.y - camera.y },
          { width: camera.width, height: camera.height },
          nextZoom
        );
        camera.setZoom(nextZoom);
        camera.setScroll(nextScroll.x, nextScroll.y);
      }
    );
  }

  private emitHoveredCell(pointer: Phaser.Input.Pointer): void {
    const snapshot = this.bridge.getSnapshot();
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / snapshot.cellSize);
    const row = Math.floor(world.y / snapshot.cellSize);
    const cell = col < 0 || col >= snapshot.cols || row < 0 || row >= snapshot.rows
      ? null
      : row * snapshot.cols + col;
    if (cell === this.hoveredCell) return;
    this.hoveredCell = cell;
    this.bridge.hoverCell(cell);
  }
}
