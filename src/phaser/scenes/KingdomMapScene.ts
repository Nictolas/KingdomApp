import Phaser from "phaser";

import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import { CHILD_BEARD_OFFSET_Y_PX, LPC_DIRECTION_ROWS } from "../../character-system/lpcPack";
import { canRenderCharacter, resolveCharacterLayers } from "../../character-system/registry";
import { PhaserFramePerformanceSampler, formatPhaserFramePerformance } from "../adapters/phaserFramePerformance";
import {
  getPhaserDynamicSnapshotChanges,
  isPhaserSimulationPaused,
  type MapSceneBridge,
  type PhaserMapBuilding,
  type PhaserMapCharacter,
  type PhaserMapSnapshot
} from "../adapters/mapSceneBridge";
import {
  computePhaserGridRangeDelta,
  computePhaserWorldViewCellRange,
  isCellInsidePhaserGridRange,
  isPointNearPhaserWorldView,
  phaserGridCellRangeContains,
  phaserGridCellRangesEqual,
  type PhaserGridCellRange
} from "../adapters/phaserViewportCulling";

const SHEET_KEY = "overworld";
const HUMAN_KEY = "human-colonist";
const GOLEM_KEY = "stone-golem";
const TILE_LAYER_DEPTH = 0;
const BUILDING_LAYER_DEPTH = 10;
const INTERACTION_LAYER_DEPTH = 30;

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
  getLpcLayerUrl?: (sourceId: string) => string | undefined;
  buildings: Record<NonNullable<PhaserMapBuilding["artKey"]>, string>;
};

type CharacterView = {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  sprites: Phaser.GameObjects.Sprite[];
  usesLpc: boolean;
  logicalCell: number;
  token: number;
  direction: 0 | 1 | 2 | 3;
};
type StaticTileView = {
  object: Phaser.GameObjects.Image;
  cell: number;
};

export class KingdomMapScene extends Phaser.Scene {
  private readonly bridge: MapSceneBridge;
  private readonly sheetUrl: string;
  private readonly artUrls: PhaserArtAssetUrls;
  private unsubscribe: (() => void) | null = null;
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private buildingLayer: Phaser.GameObjects.Container | null = null;
  private characterLayer: Phaser.GameObjects.Container | null = null;
  private interactionLayer: Phaser.GameObjects.Container | null = null;
  private gridLayer: Phaser.GameObjects.Graphics | null = null;
  private readonly characterViews = new Map<number, CharacterView>();
  private readonly pendingLpcSourceIds = new Set<string>();
  private readonly idleRoamTimers = new Map<number, Phaser.Time.TimerEvent>();
  private static readonly IDLE_ROAM_PAUSE_MS = 1600;
  private static readonly CHAT_TALK_MS = 2400;
  private readonly chatBusy = new Set<number>();
  private readonly chatPairCooldownUntil = new Map<string, number>();
  private static readonly CHAT_PAIR_COOLDOWN_MS = 240_000;
  private lpcLoadCompleteListener: (() => void) | null = null;
  private selectionRing: Phaser.GameObjects.Ellipse | null = null;
  private selectionAbitanteId: number | null = null;
  private readonly framePerformance = new PhaserFramePerformanceSampler(600);
  private lastPerfWallClockAt: number | null = null;
  private perfWork = {
    panMoves: 0,
    wheelEvents: 0,
    staticTileRefreshes: 0,
    staticTileDeltaCells: 0,
    characterVisibilityRefreshes: 0,
    characterViewsChecked: 0,
    waterViewportRefreshes: 0,
    waterSpritesChecked: 0
  };
  private perfOverlay: Phaser.GameObjects.Text | null = null;
  private perfEnabled = false;
  private nextPerfOverlayAt = 0;
  private renderedRevision = -1;
  private renderedSnapshot: PhaserMapSnapshot | null = null;
  private staticTileViews: StaticTileView[] = [];
  private readonly staticTileViewsByCell = new Map<number, Phaser.GameObjects.Image[]>();
  private lastStaticTileRange: PhaserGridCellRange | null = null;
  private staticTileVisibilityDirty = true;
  private staticTileZoomCleanupPending = false;
  private staticTileZoomCleanupAt = 0;
  private waterSprites: Phaser.GameObjects.Image[] = [];
  private waterFrame = 0;
  private nextWaterFrameAt = 0;
  private nextWaterViewportSyncAt = 0;
  private waterViewportDirty = true;
  private nextCharacterVisibilityAt = 0;
  private characterVisibilityDirty = true;
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
    for (const [key, url] of Object.entries(this.artUrls.buildings)) this.load.image(key, url);
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0).setDepth(TILE_LAYER_DEPTH);
    this.buildingLayer = this.add.container(0, 0).setDepth(BUILDING_LAYER_DEPTH);
    this.characterLayer = this.add.container(0, 0).setDepth(BUILDING_LAYER_DEPTH + 1);
    this.interactionLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH);
    this.gridLayer = this.add.graphics().setDepth(INTERACTION_LAYER_DEPTH - 1);
    this.perfEnabled = (globalThis as any).__KINGDOM_PERF_REQUESTED__ === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1");
    if (this.perfEnabled) {
      this.framePerformance.reset();
      this.lastPerfWallClockAt = null;
      (globalThis as any).__KINGDOM_PERF__ = this.framePerformance.snapshot();
      (globalThis as any).__KINGDOM_PERF_SNAPSHOT__ = () => this.framePerformance.snapshot();
      (globalThis as any).__KINGDOM_PERF_WORK_SNAPSHOT__ = () => ({ ...this.perfWork });
      (globalThis as any).__KINGDOM_PERF_RESET__ = () => {
        this.framePerformance.reset();
        this.lastPerfWallClockAt = null;
        for (const key of Object.keys(this.perfWork) as Array<keyof typeof this.perfWork>) {
          this.perfWork[key] = 0;
        }
        (globalThis as any).__KINGDOM_PERF__ = this.framePerformance.snapshot();
      };
      (globalThis as any).__KINGDOM_PERF_PAN__ = (dx: number, dy: number) => {
        this.applyCameraPan(dx, dy);
      };
      (globalThis as any).__KINGDOM_PERF_ZOOM__ = (dy: number) => {
        const camera = this.cameras.main;
        this.applyCameraWheelZoom(camera.width / 2, camera.height / 2, dy);
      };
      this.perfOverlay = this.add.text(8, 8, "PERF warming up...", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "rgba(2,6,23,0.82)",
        padding: { x: 5, y: 3 }
      }).setScrollFactor(0).setDepth(INTERACTION_LAYER_DEPTH + 100);
    }
    this.configureCharacterAnimations();
    this.configureTextureFrames(this.bridge.getSnapshot());
    this.renderSnapshot(this.bridge.getSnapshot());
    this.configureCameraAndInput();
    this.unsubscribe = this.bridge.subscribe(() => {
      const snapshot = this.bridge.getSnapshot();
      if (snapshot.revision !== this.renderedRevision || this.renderedSnapshot == null) {
        this.renderSnapshot(snapshot);
        return;
      }

      const changes = getPhaserDynamicSnapshotChanges(this.renderedSnapshot, snapshot);
      if (changes.characters) this.reconcileCharacters(snapshot);
      if (changes.grid) this.renderGrid(snapshot);
      if (changes.interaction) this.renderInteraction(snapshot);
      this.renderedSnapshot = snapshot;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      if (this.lpcLoadCompleteListener) {
        this.load.off(Phaser.Loader.Events.COMPLETE, this.lpcLoadCompleteListener);
        this.lpcLoadCompleteListener = null;
      }
      if (this.perfEnabled) {
        delete (globalThis as any).__KINGDOM_PERF_PAN__;
        delete (globalThis as any).__KINGDOM_PERF_ZOOM__;
      }
    });
  }

  private collectLpcSourceIds(appearance: NonNullable<PhaserMapCharacter["characterAppearance"]>): string[] {
    const ids = new Set<string>();
    for (const animation of ["idle", "walk"] as const) {
      if (!canRenderCharacter(appearance, animation)) continue;
      for (const layer of resolveCharacterLayers(appearance, animation)) ids.add(layer.sourceId);
    }
    return [...ids];
  }

  private ensureLpcTextures(character: PhaserMapCharacter): boolean {
    const appearance = character.characterAppearance;
    if (!appearance || !canRenderCharacter(appearance, "idle") || !this.artUrls.getLpcLayerUrl) return false;
    const ids = this.collectLpcSourceIds(appearance);
    let queued = false;
    for (const id of ids) {
      if (this.textures.exists(id) || this.pendingLpcSourceIds.has(id)) continue;
      const url = this.artUrls.getLpcLayerUrl(id);
      if (!url) continue;
      this.pendingLpcSourceIds.add(id);
      this.load.spritesheet(id, url, { frameWidth: 64, frameHeight: 64 });
      queued = true;
    }
    if (queued && !this.lpcLoadCompleteListener) {
      this.lpcLoadCompleteListener = () => {
        this.pendingLpcSourceIds.clear();
        this.reconcileCharacters(this.bridge.getSnapshot());
      };
      this.load.on(Phaser.Loader.Events.COMPLETE, this.lpcLoadCompleteListener);
    }
    if (queued && !this.load.isLoading()) this.load.start();
    return ids.length > 0 && ids.every((id) => this.textures.exists(id));
  }

  private playLpcLayerWalk(sprite: Phaser.GameObjects.Sprite, sourceId: string, direction: "down" | "left" | "right" | "up"): void {
    if (!sprite.active || !this.textures.exists(sourceId)) return;
    const key = `${sourceId}-walk-${direction}`;
    if (!this.anims.exists(key)) {
      const row = LPC_DIRECTION_ROWS[direction];
      this.anims.create({ key, frames: Array.from({ length: 9 }, (_, column) => ({ key: sourceId, frame: row * 9 + column })), frameRate: 10, repeat: -1 });
    }
    sprite.play(key, true);
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
    this.staticTileViews = [];
    this.staticTileViewsByCell.clear();
    this.lastStaticTileRange = null;
    this.staticTileVisibilityDirty = true;
    this.waterSprites = [];
    this.waterViewportDirty = true;

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
      this.registerStaticTileView(sprite, tile.index);
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
        this.registerStaticTileView(overlay, tile.index);
      }
    }

    const worldW = snapshot.cols * snapshot.cellSize;
    const worldH = snapshot.rows * snapshot.cellSize;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics?.world?.setBounds(0, 0, worldW, worldH);
    this.refreshStaticTileVisibility(true);
    this.renderedRevision = snapshot.revision;
    this.renderBuildings(snapshot);
    this.reconcileCharacters(snapshot);
    this.renderGrid(snapshot);
    this.renderInteraction(snapshot);
    this.renderedSnapshot = snapshot;
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
    if (!interaction || interaction.hoverCell == null) return;

    const color = interaction.mode === "demolish"
      ? (interaction.valid ? 0xf97316 : 0xef4444)
      : (interaction.valid ? 0x22c55e : 0xef4444);
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
    if (!this.characterLayer) return;
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
        const useLpc = character.appearance !== "golem" && this.ensureLpcTextures(character);
        const idleLayers = useLpc && character.characterAppearance
          ? resolveCharacterLayers(character.characterAppearance, "idle")
          : [];
        const texture = character.appearance === "golem" ? GOLEM_KEY : HUMAN_KEY;
        const sprite = this.add.sprite(0, -snapshot.cellSize * 0.2, useLpc ? idleLayers[0]?.sourceId ?? texture : texture, 0)
          .setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08);
        const sprites = useLpc
          ? idleLayers.map((layer) => {
              const scale = (snapshot.cellSize * 1.08) / 64;
              const beardLift = layer.layer === "beard" && character.characterAppearance?.bodyType === "child" ? CHILD_BEARD_OFFSET_Y_PX * scale : 0;
              return this.add.sprite(0, -snapshot.cellSize * 0.2 + beardLift, layer.sourceId, LPC_DIRECTION_ROWS.down * 2).setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08);
            })
          : [sprite];
        if (useLpc) sprite.setVisible(false);
        if (!character.appearance && character.markerEmoji) {
          sprite.setVisible(false);
          root.add(this.add.text(0, -snapshot.cellSize * 0.2, character.markerEmoji, { fontSize: "26px" }).setOrigin(0.5));
        }
        root.add(sprites);
        this.characterLayer.add(root);
        root.setSize(snapshot.cellSize, snapshot.cellSize).setInteractive();
        root.on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          const now = this.time.now;
          const last = this.characterLastPressAt.get(character.id) ?? 0;
          const doublePress = now - last < 340;
          this.characterLastPressAt.set(character.id, now);
          this.bridge.pressCharacter(character.id, doublePress);
        });
        view = { root, sprite, sprites, usesLpc: useLpc, logicalCell: character.cell, token: -1, direction: 0 };
        this.characterViews.set(character.id, view);
      }
      if (view.token === token) {
        if (character.idleRoamAllowed && (character.path?.length ?? 0) < 2) this.ensureIdleRoamScheduled(character.id);
        else this.stopIdleRoam(character.id);
        continue;
      }
      this.stopIdleRoam(character.id);
      this.tweens.killTweensOf(view.root);
      const start = character.path?.[0] ?? character.cell;
      this.placeCharacter(view.root, start, snapshot);
      view.logicalCell = start;
      view.token = token;
      const path = character.path?.slice(1) ?? [];
      if (path.length > 0) {
        const animatedView = view;
        this.tweens.chain({
          targets: view.root,
          tweens: path.map((cell, index) => {
            const previous = index === 0 ? start : path[index - 1];
            const pos = this.characterPosition(cell, snapshot);
            const direction = this.directionForStep(previous, cell, snapshot.cols);
            return {
              x: pos.x,
              y: pos.y,
              duration: 320,
              ease: "Linear",
              onUpdate: () => {
                animatedView.root.setDepth(Math.round(animatedView.root.y * 10));
                this.characterLayer?.sort("depth");
              },
              onStart: () => {
                const directionName = this.directionName(direction);
                if (animatedView.usesLpc && character.characterAppearance) {
                  const layers = resolveCharacterLayers(character.characterAppearance, "walk");
                  animatedView.sprites.forEach((layerSprite, layerIndex) => {
                    const layer = layers[layerIndex];
                    if (!layer || !this.textures.exists(layer.sourceId)) { layerSprite.setVisible(false); return; }
                    layerSprite.setVisible(true).setTexture(layer.sourceId);
                    this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName);
                  });
                } else animatedView.sprite.play(`${animatedView.sprite.texture.key}-walk-${directionName}`, true);
                animatedView.direction = direction;
              }
            };
          }),
          onComplete: () => {
            if (animatedView.usesLpc && character.characterAppearance) {
              const layers = resolveCharacterLayers(character.characterAppearance, "idle");
              const directionName = this.directionName(animatedView.direction);
              animatedView.sprites.forEach((layerSprite, layerIndex) => {
                const layer = layers[layerIndex];
                layerSprite.anims.stop();
                if (!layer || !this.textures.exists(layer.sourceId)) { layerSprite.setVisible(false); return; }
                layerSprite.setVisible(true).setTexture(layer.sourceId).setFrame(LPC_DIRECTION_ROWS[directionName] * 2);
              });
            } else animatedView.sprite.stop().setFrame(animatedView.direction);
            this.bridge.completeCharacterPath(character.id, token);
          }
        });
      }
    }
    this.characterVisibilityDirty = true;
    this.renderSelectionMarker(snapshot);
  }

  private stopIdleRoam(characterId: number): void {
    const timer = this.idleRoamTimers.get(characterId);
    if (timer) timer.remove(false);
    this.idleRoamTimers.delete(characterId);
  }

  private ensureIdleRoamScheduled(characterId: number): void {
    if (this.idleRoamTimers.has(characterId)) return;
    const timer = this.time.delayedCall(KingdomMapScene.IDLE_ROAM_PAUSE_MS, () => {
      this.idleRoamTimers.delete(characterId);
      const snapshot = this.bridge.getSnapshot();
      const character = snapshot.characters.find((c) => c.id === characterId);
      const view = this.characterViews.get(characterId);
      if (!character?.idleRoamAllowed || !view?.root?.active || (character.path?.length ?? 0) >= 2) return;
      const nearby = snapshot.characters.find((other) => {
        if (other.id === characterId || !other.idleRoamAllowed || (other.path?.length ?? 0) >= 2) return false;
        const otherView = this.characterViews.get(other.id);
        if (!otherView?.root?.active) return false;
        const aCol = view.logicalCell % snapshot.cols, aRow = Math.floor(view.logicalCell / snapshot.cols);
        const bCol = otherView.logicalCell % snapshot.cols, bRow = Math.floor(otherView.logicalCell / snapshot.cols);
        const distance = Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
        return distance >= 1 && distance <= 3;
      });
      if (nearby) {
        const otherView = this.characterViews.get(nearby.id);
        if (otherView) {
          const aCol = view.logicalCell % snapshot.cols, aRow = Math.floor(view.logicalCell / snapshot.cols);
          const bCol = otherView.logicalCell % snapshot.cols, bRow = Math.floor(otherView.logicalCell / snapshot.cols);
          const distance = Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
          if (distance > 1 && Math.random() < 0.35) {
            const stepCol = aCol + Math.sign(bCol - aCol);
            const stepRow = bCol === aCol ? aRow + Math.sign(bRow - aRow) : aRow;
            const destination = stepRow * snapshot.cols + stepCol;
            const pos = this.characterPosition(destination, snapshot);
            view.direction = this.directionForStep(view.logicalCell, destination, snapshot.cols);
            this.tweens.add({ targets: view.root, x: pos.x, y: pos.y, duration: 320, ease: "Linear", onUpdate: () => { view.root.setDepth(Math.round(view.root.y * 10)); this.characterLayer?.sort("depth"); }, onComplete: () => { view.logicalCell = destination; this.ensureIdleRoamScheduled(characterId); } });
            return;
          }
        }
      }
      const pairKey = nearby ? [characterId, nearby.id].sort((a, b) => a - b).join(":") : null;
      const pairOnCooldown = pairKey != null && (this.chatPairCooldownUntil.get(pairKey) ?? 0) > this.time.now;
      if (nearby && !pairOnCooldown && Math.random() < 0.35 && !this.chatBusy.has(characterId) && !this.chatBusy.has(nearby.id)) {
        const otherView = this.characterViews.get(nearby.id);
        if (otherView) {
          view.direction = this.directionForStep(view.logicalCell, otherView.logicalCell, snapshot.cols);
          otherView.direction = this.directionForStep(otherView.logicalCell, view.logicalCell, snapshot.cols);
          const otherCharacter = snapshot.characters.find((c) => c.id === nearby.id);
          this.setCharacterIdleFrame(view, character);
          if (otherCharacter) this.setCharacterIdleFrame(otherView, otherCharacter);
          this.stopIdleRoam(nearby.id);
          this.chatBusy.add(characterId);
          this.chatBusy.add(nearby.id);
          if (pairKey) this.chatPairCooldownUntil.set(pairKey, this.time.now + KingdomMapScene.CHAT_PAIR_COOLDOWN_MS);
          this.time.delayedCall(KingdomMapScene.CHAT_TALK_MS, () => {
            this.chatBusy.delete(characterId);
            this.chatBusy.delete(nearby.id);
            this.ensureIdleRoamScheduled(characterId);
            this.ensureIdleRoamScheduled(nearby.id);
          });
          return;
        }
      }
      const dirs: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
      view.direction = dirs[Math.floor(Math.random() * dirs.length)] ?? view.direction;
      if (Math.random() < 0.3) {
        const col = view.logicalCell % snapshot.cols;
        const row = Math.floor(view.logicalCell / snapshot.cols);
        const candidates = [row + 1 < snapshot.rows ? view.logicalCell + snapshot.cols : null, col > 0 ? view.logicalCell - 1 : null, col + 1 < snapshot.cols ? view.logicalCell + 1 : null, row > 0 ? view.logicalCell - snapshot.cols : null].filter((cell): cell is number => cell != null);
        const destination = candidates[Math.floor(Math.random() * candidates.length)];
        if (destination != null) {
          const pos = this.characterPosition(destination, snapshot);
          view.direction = this.directionForStep(view.logicalCell, destination, snapshot.cols);
          this.tweens.add({ targets: view.root, x: pos.x, y: pos.y, duration: 320, ease: "Linear", onUpdate: () => { view.root.setDepth(Math.round(view.root.y * 10)); this.characterLayer?.sort("depth"); }, onComplete: () => { view.logicalCell = destination; this.ensureIdleRoamScheduled(characterId); } });
        }
      }
      if (view.usesLpc && character.characterAppearance) {
        const layers = resolveCharacterLayers(character.characterAppearance, "idle");
        const directionName = this.directionName(view.direction);
        view.sprites.forEach((layerSprite, index) => {
          const layer = layers[index];
          if (layer && this.textures.exists(layer.sourceId)) layerSprite.setTexture(layer.sourceId).setFrame(LPC_DIRECTION_ROWS[directionName] * 2);
        });
      } else view.sprite.stop().setFrame(view.direction);
      this.ensureIdleRoamScheduled(characterId);
    });
    this.idleRoamTimers.set(characterId, timer);
  }

  private clearSelectionRing(): void {
    if (this.selectionRing) {
      this.tweens.killTweensOf(this.selectionRing);
      if (this.selectionRing.scene) this.selectionRing.destroy();
      this.selectionRing = null;
    }
    this.selectionAbitanteId = null;
  }

  private renderSelectionMarker(snapshot: PhaserMapSnapshot): void {
    const id = snapshot.selectedAbitanteId ?? null;
    if (id == null) {
      this.clearSelectionRing();
      return;
    }
    const view = this.characterViews.get(id);
    if (!view) {
      this.clearSelectionRing();
      return;
    }
    const same = this.selectionRing != null && this.selectionAbitanteId === id && this.selectionRing.parentContainer === view.root;
    if (same) return;
    this.clearSelectionRing();
    this.selectionAbitanteId = id;
    const s = snapshot.cellSize;
    const ring = this.add.ellipse(0, s * 0.25, s * 0.78, s * 0.3, 0x22c55e, 0.38).setStrokeStyle(2.5, 0x86efac, 0.95);
    view.root.addAt(ring, 0);
    this.selectionRing = ring;
  }

  private directionForStep(from: number, to: number, cols: number): 0 | 1 | 2 | 3 {
    const delta = to - from;
    if (delta === -1) return 1;
    if (delta === 1) return 2;
    if (delta === -cols) return 3;
    return 0;
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
    root.setDepth(Math.round(pos.y * 10));
    this.characterLayer?.sort("depth");
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

      if (building.artKey) {
        const image = this.add.image(width / 2, height, building.artKey).setOrigin(0.5, 1);
        const scale = Math.min((width * 1.12) / image.width, (height + snapshot.cellSize * 0.75) / image.height);
        image.setScale(scale);
        const shadow = this.add.ellipse(width / 2 + 2, height - 2, width * 0.82, snapshot.cellSize * 0.3, 0x000000, 0.25);
        const label = this.add.text(width / 2, height - 3, building.name, {
          fontFamily: "Arial, sans-serif", fontSize: `${Math.max(8, snapshot.cellSize * 0.22)}px`,
          color: "#ffffff", backgroundColor: "rgba(2,6,23,0.72)", padding: { x: 3, y: 1 }
        }).setOrigin(0.5, 1);
        group.add([shadow, image, label]);
        this.buildingLayer.add(group);
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

      group.add([shadow, body, roof, emoji, label]);
      this.buildingLayer.add(group);
    }
  }

  update(time: number, delta: number): void {
    if (this.perfEnabled) {
      // Phaser's delta can be smoothed/clamped toward the target frame rate.
      // Use browser wall-clock time so CI/headless measurements reflect real frame stalls.
      const wallClockNow = performance.now();
      if (this.lastPerfWallClockAt != null) {
        this.framePerformance.push(wallClockNow - this.lastPerfWallClockAt);
      }
      this.lastPerfWallClockAt = wallClockNow;
      if (time >= this.nextPerfOverlayAt) {
        const metrics = this.framePerformance.snapshot();
        (globalThis as any).__KINGDOM_PERF__ = metrics;
        this.perfOverlay?.setText(formatPhaserFramePerformance(metrics));
        this.perfOverlay?.setScale(1 / this.cameras.main.zoom);
        this.nextPerfOverlayAt = time + 1000;
      }
    }

    if (this.staticTileVisibilityDirty) {
      this.refreshStaticTileVisibility();
      this.staticTileZoomCleanupPending = false;
    } else if (this.staticTileZoomCleanupPending && time >= this.staticTileZoomCleanupAt) {
      this.refreshStaticTileVisibility();
      this.staticTileZoomCleanupPending = false;
    }

    if (this.characterVisibilityDirty || time >= this.nextCharacterVisibilityAt) {
      this.refreshCharacterVisibility();
      this.characterVisibilityDirty = false;
      this.nextCharacterVisibilityAt = time + 120;
    }

    const simulationPaused = isPhaserSimulationPaused(this.bridge.getSnapshot());
    if (simulationPaused) {
      // Come il vecchio layer React dell'acqua: in pausa il frame resta fermo.
      // Spostiamo anche la prossima scadenza, così alla ripresa non scatta subito un frame arretrato.
      this.nextWaterFrameAt = time + 420;
    }
    const waterFrameDue =
      !simulationPaused && this.waterSprites.length > 0 && time >= this.nextWaterFrameAt;
    if (waterFrameDue) {
      this.nextWaterFrameAt = time + 420;
      this.waterFrame = (this.waterFrame + 1) % OVERWORLD_SHEET_PX.waterFrames;
      this.waterViewportDirty = true;
    }

    if (
      this.waterViewportDirty &&
      this.waterSprites.length > 0 &&
      (waterFrameDue || time >= this.nextWaterViewportSyncAt)
    ) {
      this.refreshVisibleWaterFrames();
      this.waterViewportDirty = false;
      this.nextWaterViewportSyncAt = time + 120;
    }
  }

  private registerStaticTileView(object: Phaser.GameObjects.Image, cell: number): void {
    this.staticTileViews.push({ object, cell });
    const cellViews = this.staticTileViewsByCell.get(cell);
    if (cellViews) cellViews.push(object);
    else this.staticTileViewsByCell.set(cell, [object]);
  }

  private setStaticTileCellVisibility(cell: number, visible: boolean): void {
    for (const object of this.staticTileViewsByCell.get(cell) ?? []) {
      if (object.visible !== visible) object.setVisible(visible);
    }
  }

  private refreshStaticTileVisibility(force = false): void {
    if (this.staticTileViews.length === 0) {
      this.staticTileVisibilityDirty = false;
      return;
    }
    const snapshot = this.bridge.getSnapshot();
    const camera = this.cameras.main;
    const worldView = {
      x: camera.worldView.x,
      y: camera.worldView.y,
      width: camera.worldView.width,
      height: camera.worldView.height
    };
    const range = computePhaserWorldViewCellRange(
      worldView,
      snapshot.cols,
      snapshot.rows,
      snapshot.cellSize,
      2
    );
    this.staticTileVisibilityDirty = false;
    if (!force && phaserGridCellRangesEqual(this.lastStaticTileRange, range)) return;
    if (this.perfEnabled) this.perfWork.staticTileRefreshes += 1;

    if (force || this.lastStaticTileRange == null) {
      for (const tileView of this.staticTileViews) {
        const visible = isCellInsidePhaserGridRange(tileView.cell, snapshot.cols, range);
        if (tileView.object.visible !== visible) tileView.object.setVisible(visible);
      }
    } else {
      const delta = computePhaserGridRangeDelta(this.lastStaticTileRange, range, snapshot.cols);
      if (this.perfEnabled) this.perfWork.staticTileDeltaCells += delta.hiddenCells.length + delta.shownCells.length;
      for (const cell of delta.hiddenCells) this.setStaticTileCellVisibility(cell, false);
      for (const cell of delta.shownCells) this.setStaticTileCellVisibility(cell, true);
    }

    this.lastStaticTileRange = range;
  }

  private refreshVisibleWaterFrames(): void {
    if (this.waterSprites.length === 0) return;
    if (this.perfEnabled) {
      this.perfWork.waterViewportRefreshes += 1;
      this.perfWork.waterSpritesChecked += this.waterSprites.length;
    }
    const snapshot = this.bridge.getSnapshot();
    const camera = this.cameras.main;
    const padding = snapshot.cellSize * 1.5;
    const worldView = {
      x: camera.worldView.x,
      y: camera.worldView.y,
      width: camera.worldView.width,
      height: camera.worldView.height
    };
    const key = frameKey(
      OVERWORLD_SHEET_PX.waterAnimX + this.waterFrame * OVERWORLD_SHEET_PX.tile,
      OVERWORLD_SHEET_PX.waterAnimY
    );

    for (const sprite of this.waterSprites) {
      if (isPointNearPhaserWorldView(sprite.x, sprite.y, worldView, padding)) sprite.setFrame(key);
    }
  }

  private refreshCharacterVisibility(): void {
    if (this.characterViews.size === 0) return;
    if (this.perfEnabled) {
      this.perfWork.characterVisibilityRefreshes += 1;
      this.perfWork.characterViewsChecked += this.characterViews.size;
    }
    const snapshot = this.bridge.getSnapshot();
    const camera = this.cameras.main;
    const padding = snapshot.cellSize * 1.5;
    const worldView = {
      x: camera.worldView.x,
      y: camera.worldView.y,
      width: camera.worldView.width,
      height: camera.worldView.height
    };

    for (const characterView of this.characterViews.values()) {
      const visible = isPointNearPhaserWorldView(
        characterView.root.x,
        characterView.root.y,
        worldView,
        padding
      );
      if (characterView.root.visible !== visible) characterView.root.setVisible(visible);
    }
  }

  private applyCameraPan(dx: number, dy: number): void {
    const camera = this.cameras.main;
    if (this.perfEnabled) this.perfWork.panMoves += 1;
    camera.scrollX -= dx / camera.zoom;
    camera.scrollY -= dy / camera.zoom;
    this.characterVisibilityDirty = true;
    this.waterViewportDirty = true;
    this.staticTileVisibilityDirty = true;
    this.staticTileZoomCleanupPending = false;
  }

  private applyCameraWheelZoom(pointerX: number, pointerY: number, dy: number): void {
    const camera = this.cameras.main;
    if (this.perfEnabled) this.perfWork.wheelEvents += 1;
    const before = camera.getWorldPoint(pointerX, pointerY);
    const nextZoom = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 3);
    camera.setZoom(nextZoom);
    const after = camera.getWorldPoint(pointerX, pointerY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    this.characterVisibilityDirty = true;
    this.waterViewportDirty = true;

    const snapshot = this.bridge.getSnapshot();
    const worldView = {
      x: camera.worldView.x,
      y: camera.worldView.y,
      width: camera.worldView.width,
      height: camera.worldView.height
    };
    const visibleRange = computePhaserWorldViewCellRange(
      worldView,
      snapshot.cols,
      snapshot.rows,
      snapshot.cellSize,
      0
    );
    if (
      this.staticTileVisibilityDirty ||
      !phaserGridCellRangeContains(this.lastStaticTileRange, visibleRange)
    ) {
      this.staticTileVisibilityDirty = true;
      this.staticTileZoomCleanupPending = false;
    } else {
      this.staticTileZoomCleanupPending = true;
      this.staticTileZoomCleanupAt = this.time.now + 180;
    }
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
      this.applyCameraPan(dx, dy);
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
        this.applyCameraWheelZoom(pointer.x, pointer.y, dy);
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
