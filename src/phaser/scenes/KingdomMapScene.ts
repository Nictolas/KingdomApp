import Phaser from "phaser";
import { layoutNorthernForestTrees, ritaglioAlphaAlbero } from "../../game/forestaSpriteGrid";

import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import { CHILD_BEARD_OFFSET_Y_PX, LPC_DIRECTION_ROWS } from "../../character-system/lpcPack";
import { characterStepDurationMs, lpcFrameForRow } from "../adapters/characterWalkMotion";
import { resolveLocateTrackingPosition, type LocateTrackingPosition } from "../adapters/locateTracking";
import { getLpcVisualGeometry } from "../adapters/lpcCharacterGeometry";
import { lpcLookFromSearch } from "../../character-system/lpcVisualExperiment";
import { canRenderCharacter, resolveCharacterLayers } from "../../character-system/registry";
import { isGeometryEntryCell } from "../../game/buildingGeometry";
import {
  getOrologioSimTimeScaleSnapshot,
  getOrologioGiocoVelocitaSnapshot,
  scalaDurataRealeMs,
  subscribeOrologioGiocoInPausa,
  subscribeOrologioGiocoVelocita
} from "../../game/orologioGiocoSession";
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
const GOLEM_KEY = "stone-golem";
// A/B prova grafica: aggiungi ?lpcLook=classic all'URL per la versione originale.
const LPC_VISUAL_MODE = lpcLookFromSearch(typeof window !== "undefined" ? window.location.search : "");
const TILE_LAYER_DEPTH = 0;
const BUILDING_LAYER_DEPTH = 10;
const INTERACTION_LAYER_DEPTH = 30;
const LOCATE_LAYER_DEPTH = 220;
const WORLD_DEPTH_BASE = 100;
// Più leggibilità sulla mappa senza modificare celle, percorsi e ingombri degli edifici.
const CHARACTER_VISUAL_SCALE = 1.18;
const MOBILE_INITIAL_CAMERA_ZOOM = 1.12;
const MOBILE_VIEWPORT_MAX_WIDTH = 768;

function worldDepthForY(y: number): number {
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
  golem: string;
  forestTrees?: readonly string[];
  getLpcLayerUrl?: (sourceId: string) => string | undefined;
  getLpcLayerFrameSize?: (sourceId: string) => number;
  buildings: Record<
    NonNullable<PhaserMapBuilding["artKey"]>,
    string | { base: string; overlay?: string; doorway?: string }
  >;
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
  private worldLayer: Phaser.GameObjects.Container | null = null;
  private buildingViews: Phaser.GameObjects.Container[] = [];
  /** Bordo superiore in coordinate mondo degli sprite effettivamente disegnati. */
  private readonly renderedRoofTopByAnchor = new Map<number, number>();
  private interactionLayer: Phaser.GameObjects.Container | null = null;
  private locateLayer: Phaser.GameObjects.Container | null = null;
  private locateArrow: Phaser.GameObjects.Container | null = null;
  private locateAbitanteId: number | null = null;
  private locateCell: number | null = null;
  private locateBuildingAnchor: number | null = null;
  private lastLocateCameraCullPosition: { x: number; y: number } | null = null;
  private gridLayer: Phaser.GameObjects.Graphics | null = null;
  private readonly characterViews = new Map<number, CharacterView>();
  private readonly pendingLpcSourceIds = new Set<string>();
  private readonly idleRoamTimers = new Map<number, Phaser.Time.TimerEvent>();
  private static readonly IDLE_ROAM_PAUSE_MS = 1600;
  private static readonly CHAT_TALK_GAME_MINUTES = 60;
  private readonly chatBusy = new Set<number>();
  /** Partner della chiacchiera attiva; mantiene coerente la coppia durante abort/remount. */
  private readonly chatPartnerById = new Map<number, number>();
  private readonly chatPairCooldownUntil = new Map<string, number>();
  private readonly chatTalkTimers = new Map<number, Phaser.Time.TimerEvent>();
  private static readonly CHAT_PAIR_COOLDOWN_MS = 240_000;
  private readonly claimFailCounts = new Map<number, number>();
  private static readonly CLAIM_RETRY_MS = 250;
  private static readonly MAX_CLAIM_FAILS_BEFORE_REPATH = 3;
  private lpcLoadCompleteListener: (() => void) | null = null;
  private unsubscribeSimTime: (() => void) | null = null;
  private characterAssetsReadyNotified = false;
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
    this.artUrls.forestTrees?.forEach((url, index) => this.load.image(`northern-forest-tree-${index}`, url));
    this.load.spritesheet(GOLEM_KEY, this.artUrls.golem, { frameWidth: 64, frameHeight: 64 });
    for (const [key, asset] of Object.entries(this.artUrls.buildings)) {
      if (typeof asset === "string") {
        this.load.image(key, asset);
      } else {
        this.load.image(key, asset.base);
        if (asset.overlay) this.load.image(`${key}-overlay`, asset.overlay);
        if (asset.doorway) this.load.image(`${key}-doorway`, asset.doorway);
      }
    }
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0).setDepth(TILE_LAYER_DEPTH);
    this.worldLayer = this.add.container(0, 0).setDepth(BUILDING_LAYER_DEPTH);
    this.interactionLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH);
    this.locateLayer = this.add.container(0, 0).setDepth(LOCATE_LAYER_DEPTH);
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
    this.syncCharacterSimTimeScale();
    const unsubPausa = subscribeOrologioGiocoInPausa(() => this.syncCharacterSimTimeScale());
    const unsubVelocita = subscribeOrologioGiocoVelocita(() => this.syncCharacterSimTimeScale());
    this.unsubscribeSimTime = () => {
      unsubPausa();
      unsubVelocita();
    };
    this.configureTextureFrames(this.bridge.getSnapshot());
    this.renderSnapshot(this.bridge.getSnapshot());
    this.tryNotifyCharacterAssetsReady(this.bridge.getSnapshot());
    this.configureCameraAndInput();
    this.bridge.registerSceneControls({
      refreshViewport: () => this.refreshViewportAfterFocus(),
      resumeInteractions: () => this.resumeInteractionAfterFocus(),
      centerOnCell: (cellIndex, options) => this.centerCameraOnCell(cellIndex, options)
    });
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
      this.renderLocateMarker(snapshot);
      this.renderSelectionMarker(snapshot);
      this.renderedSnapshot = snapshot;
      this.tryNotifyCharacterAssetsReady(snapshot);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bridge.registerSceneControls(null);
      this.unsubscribe?.();
      this.unsubscribeSimTime?.();
      this.unsubscribeSimTime = null;
      for (const timer of this.chatTalkTimers.values()) timer.remove(false);
      this.chatTalkTimers.clear();
      this.chatPartnerById.clear();
      this.chatBusy.clear();
      this.clearSelectionRing();
      this.clearLocateArrow();
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

  private syncCharacterSimTimeScale(): void {
    const scale = getOrologioSimTimeScaleSnapshot();
    this.tweens.timeScale = scale;
    this.anims.globalTimeScale = scale;
  }

  private clearChatTalkTimer(characterId: number): void {
    const anchorId = characterId;
    const timer = this.chatTalkTimers.get(anchorId);
    if (!timer) return;
    timer.remove(false);
    this.chatTalkTimers.delete(anchorId);
  }

  private abortChatFor(characterId: number): void {
    const partnerId = this.chatPartnerById.get(characterId);
    if (partnerId == null) {
      this.chatBusy.delete(characterId);
      return;
    }

    const anchorId = Math.min(characterId, partnerId);
    this.clearChatTalkTimer(anchorId);
    this.chatPartnerById.delete(characterId);
    this.chatPartnerById.delete(partnerId);
    this.chatBusy.delete(characterId);
    this.chatBusy.delete(partnerId);
    this.bridge.notifyCharacterChatChange(characterId, null);
    this.bridge.notifyCharacterChatChange(partnerId, null);

    // Il partner rimasto libero può tornare al roaming.
    this.ensureIdleRoamScheduled(partnerId);
  }

  private startChatTalkTimer(characterId: number, partnerId: number): void {
    const anchorId = Math.min(characterId, partnerId);
    this.clearChatTalkTimer(anchorId);
    let remainingGameMinutes = KingdomMapScene.CHAT_TALK_GAME_MINUTES;

    const finish = () => {
      this.chatTalkTimers.delete(anchorId);
      if (
        this.chatPartnerById.get(characterId) !== partnerId ||
        this.chatPartnerById.get(partnerId) !== characterId
      ) return;
      this.chatPartnerById.delete(characterId);
      this.chatPartnerById.delete(partnerId);
      this.chatBusy.delete(characterId);
      this.chatBusy.delete(partnerId);
      this.bridge.notifyCharacterChatChange(characterId, null);
      this.bridge.notifyCharacterChatChange(partnerId, null);
      this.bridge.notifyCharacterChatFinished(characterId, partnerId);
      const pairKey = [characterId, partnerId].sort((a, b) => a - b).join(":");
      this.chatPairCooldownUntil.set(
        pairKey,
        this.time.now +
          scalaDurataRealeMs(
            KingdomMapScene.CHAT_PAIR_COOLDOWN_MS,
            getOrologioGiocoVelocitaSnapshot()
          )
      );
      this.ensureIdleRoamScheduled(characterId);
      this.ensureIdleRoamScheduled(partnerId);
    };

    const tick = () => {
      if (
        this.chatPartnerById.get(characterId) !== partnerId ||
        this.chatPartnerById.get(partnerId) !== characterId
      ) {
        this.chatTalkTimers.delete(anchorId);
        return;
      }
      if (isPhaserSimulationPaused(this.bridge.getSnapshot())) {
        const timer = this.time.delayedCall(400, tick);
        this.chatTalkTimers.set(anchorId, timer);
        return;
      }
      remainingGameMinutes -= 1;
      if (remainingGameMinutes <= 0) {
        finish();
        return;
      }
      const timer = this.time.delayedCall(
        scalaDurataRealeMs(1000, getOrologioGiocoVelocitaSnapshot()),
        tick
      );
      this.chatTalkTimers.set(anchorId, timer);
    };

    tick();
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
      const pixelSize = this.artUrls.getLpcLayerFrameSize?.(id) ?? 64;
      this.load.spritesheet(id, url, { frameWidth: pixelSize, frameHeight: pixelSize });
      queued = true;
    }
    if (queued && !this.lpcLoadCompleteListener) {
      this.lpcLoadCompleteListener = () => {
        this.pendingLpcSourceIds.clear();
        const snapshot = this.bridge.getSnapshot();
        this.reconcileCharacters(snapshot);
        this.tryNotifyCharacterAssetsReady(snapshot);
      };
      this.load.on(Phaser.Loader.Events.COMPLETE, this.lpcLoadCompleteListener);
    }
    if (queued && !this.load.isLoading()) this.load.start();
    return ids.length > 0 && ids.every((id) => this.textures.exists(id));
  }

  private characterNeedsLpc(character: PhaserMapCharacter): boolean {
    const appearance = character.characterAppearance;
    if (!appearance || !canRenderCharacter(appearance, "idle") || !this.artUrls.getLpcLayerUrl) return false;
    return this.collectLpcSourceIds(appearance).some((id) => !!this.artUrls.getLpcLayerUrl?.(id));
  }

  private lpcLayersReady(character: PhaserMapCharacter): boolean {
    const appearance = character.characterAppearance;
    if (!appearance || !canRenderCharacter(appearance, "idle")) return false;
    const ids = this.collectLpcSourceIds(appearance).filter((id) => !!this.artUrls.getLpcLayerUrl?.(id));
    return ids.length === 0 || ids.every((id) => this.textures.exists(id));
  }

  private tryNotifyCharacterAssetsReady(snapshot: PhaserMapSnapshot): void {
    if (this.characterAssetsReadyNotified) return;
    if (this.pendingLpcSourceIds.size > 0 || this.load.isLoading()) return;
    const waitingForLpc = snapshot.characters.some(
      (character) => this.characterNeedsLpc(character) && !this.lpcLayersReady(character)
    );
    if (waitingForLpc) return;
    this.characterAssetsReadyNotified = true;
    this.bridge.notifyCharacterAssetsReady();
  }

  private playLpcLayerWalk(sprite: Phaser.GameObjects.Sprite, sourceId: string, direction: "down" | "left" | "right" | "up", cellSize: number, bodyType: string): void {
    if (!sprite.active || !this.textures.exists(sourceId)) return;
    const key = `${sourceId}-walk-${direction}`;
    const firstFrame = lpcFrameForRow(LPC_DIRECTION_ROWS[direction], 9);
    if (!this.anims.exists(key)) {
      this.anims.create({ key, frames: Array.from({ length: 9 }, (_, column) => ({ key: sourceId, frame: firstFrame + column })), frameRate: 10, repeat: -1 });
    }
    // setTexture() senza frame mostra per un istante la prima riga ("up").
    // Non reimpostare la texture a ogni cella e conserva la direzione corretta al cambio.
    if (sprite.texture.key !== sourceId) {
      const size = getLpcVisualGeometry(cellSize, bodyType, LPC_VISUAL_MODE);
      sprite.setTexture(sourceId, firstFrame).setDisplaySize(size.width, size.height);
    }
    sprite.play(key, true);
  }

  private configureCharacterAnimations(): void {
    for (const [name, direction] of [["down", 0], ["left", 1], ["right", 2], ["up", 3]] as const) {
      this.anims.create({
        key: `${GOLEM_KEY}-walk-${name}`,
        frames: [direction, 4 + direction, 8 + direction, 4 + direction].map((frame) => ({ key: GOLEM_KEY, frame })),
        frameRate: 8,
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
    this.staticTileViews = [];
    this.staticTileViewsByCell.clear();
    this.lastStaticTileRange = null;
    this.staticTileVisibilityDirty = true;
    this.waterSprites = [];
    this.waterViewportDirty = true;

    // Tessere native 64x64: nessun ingrandimento frazionario dei pixel.
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
        .setDisplaySize(snapshot.cellSize, snapshot.cellSize);
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
    this.renderLocateMarker(snapshot);
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
    if (!interaction || interaction.mode === "select" || interaction.hoverCell == null) return;

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

  private isActiveCharacterView(view: CharacterView, characterId: number, pathToken?: number): boolean {
    if (this.characterViews.get(characterId) !== view) return false;
    if (!view.root?.active) return false;
    if (pathToken != null && view.token !== pathToken) return false;
    return true;
  }

  private setCharacterIdleFrame(view: CharacterView, character: PhaserMapCharacter): void {
    if (!view.root?.active) return;
    if (view.usesLpc && character.characterAppearance) {
      const layers = resolveCharacterLayers(character.characterAppearance, "idle");
      const directionName = this.directionName(view.direction);
      const size = getLpcVisualGeometry(this.bridge.getSnapshot().cellSize, character.characterAppearance.bodyType, LPC_VISUAL_MODE);
      view.sprites.forEach((layerSprite, layerIndex) => {
        if (!layerSprite?.active) return;
        const layer = layers[layerIndex];
        layerSprite.anims.stop();
        if (!layer || !this.textures.exists(layer.sourceId)) {
          layerSprite.setVisible(false);
          return;
        }
        layerSprite.setVisible(true).setTexture(layer.sourceId).setFrame(lpcFrameForRow(LPC_DIRECTION_ROWS[directionName], layer.sheet.columns)).setDisplaySize(size.width, size.height);
      });
      return;
    }
    if (view.sprite?.active) view.sprite.stop().setFrame(view.direction);
  }

  private reconcileCharacters(snapshot: PhaserMapSnapshot): void {
    if (!this.worldLayer) return;
    const active = new Set(snapshot.characters.map((character) => character.id));
    for (const [id, view] of this.characterViews) {
      if (active.has(id)) continue;
      this.stopIdleRoam(id);
      view.root.destroy(true);
      this.characterViews.delete(id);
    }

    for (const character of snapshot.characters) {
      const token = character.pathToken ?? 0;
      let view = this.characterViews.get(character.id);
      const needsLpc = this.characterNeedsLpc(character);
      const lpcReady = needsLpc && this.ensureLpcTextures(character);
      if (needsLpc && !lpcReady) {
        if (view) {
          this.stopIdleRoam(character.id);
          this.tweens.killTweensOf(view.root);
          view.root.destroy(true);
          this.characterViews.delete(character.id);
        }
        continue;
      }
      if (view && view.usesLpc !== lpcReady) {
        this.stopIdleRoam(character.id);
        this.tweens.killTweensOf(view.root);
        view.root.destroy(true);
        this.characterViews.delete(character.id);
        view = undefined;
      }
      if (!view) {
        const root = this.add.container(0, 0);
        const useLpc = lpcReady;
        const idleLayers =
          useLpc && character.characterAppearance
            ? resolveCharacterLayers(character.characterAppearance, "idle")
            : [];

        let sprite: Phaser.GameObjects.Sprite;
        let sprites: Phaser.GameObjects.Sprite[];
        const displaySize = snapshot.cellSize * CHARACTER_VISUAL_SCALE;
        // Conserva il punto d'appoggio dei piedi anche dopo l'ingrandimento.
        const spriteY = -snapshot.cellSize * 0.2 - (displaySize - snapshot.cellSize) * 0.45;

        if (useLpc) {
          if (idleLayers.length === 0) continue;
          const size = getLpcVisualGeometry(snapshot.cellSize, character.characterAppearance?.bodyType ?? "male", LPC_VISUAL_MODE);
          sprites = idleLayers.map((layer) => {
            const beardLift =
              layer.layer === "beard" && character.characterAppearance?.bodyType === "child"
                ? CHILD_BEARD_OFFSET_Y_PX * size.pixelsToDisplayY
                : 0;
            return this.add
              .sprite(
                0,
                size.offsetY + beardLift,
                layer.sourceId,
                LPC_DIRECTION_ROWS.down * 2
              )
              .setDisplaySize(size.width, size.height);
          });
          sprite = sprites[0]!;
        } else {
          const canSpawnGolem = character.appearance === "golem";
          const canSpawnEmoji = !!character.markerEmoji;
          if (!canSpawnGolem && !canSpawnEmoji) continue;
          sprite = this.add
            .sprite(0, spriteY, GOLEM_KEY, 0)
            .setDisplaySize(displaySize, displaySize);
          sprites = [sprite];
        }

        root.add(sprites);
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
      const finalPathCell = character.path?.[(character.path?.length ?? 0) - 1];
      const enteringBuilding = snapshot.buildings.find(
        (building) => finalPathCell != null && isGeometryEntryCell(building.geometry, finalPathCell)
      );
      const exitingBuilding = snapshot.buildings.find((building) => {
        const footprint = building.geometry.footprint;
        const col = character.cell % snapshot.cols;
        const row = Math.floor(character.cell / snapshot.cols);
        const pathStart = character.path?.[0];
        return (
          pathStart != null &&
          isGeometryEntryCell(building.geometry, pathStart) &&
          col >= footprint.col &&
          col < footprint.col + footprint.width &&
          row >= footprint.row &&
          row < footprint.row + footprint.height
        );
      });

      if (exitingBuilding && (exitingBuilding.geometry.entryPoints?.length ?? 0) <= 1) {
        view.root.setPosition(
          exitingBuilding.geometry.interiorSpawnPoint.x * snapshot.cellSize,
          exitingBuilding.geometry.interiorSpawnPoint.y * snapshot.cellSize
        );
        this.updateCharacterDepth(view.root);
      } else {
        this.placeCharacter(view.root, start, snapshot);
      }

      view.logicalCell = start;
      view.token = token;

      const waypoints = (character.path?.slice(1) ?? []).map((cell) => ({
        ...this.characterPosition(cell, snapshot),
        cell
      }));

      if (exitingBuilding && (exitingBuilding.geometry.entryPoints?.length ?? 0) <= 1) {
        waypoints.unshift({
          x: (exitingBuilding.geometry.doorway.col + exitingBuilding.geometry.doorway.width / 2) * snapshot.cellSize,
          y: (exitingBuilding.geometry.doorway.row + 0.92) * snapshot.cellSize,
          cell: exitingBuilding.geometry.doorCell
        });
      }

      if (enteringBuilding && (enteringBuilding.geometry.entryPoints?.length ?? 0) <= 1) {
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
        const pathToken = token;
        let currentCell = start;

        const moveNext = (index: number) => {
          if (!this.isActiveCharacterView(animatedView, character.id, pathToken)) return;
          if (index >= waypoints.length) {
            animatedView.logicalCell = currentCell;
            this.claimFailCounts.delete(character.id);
            this.setCharacterIdleFrame(animatedView, character);
            this.bridge.completeCharacterPath(character.id, pathToken);
            return;
          }

          const waypoint = waypoints[index]!;
          const softSharedEntry =
            (finalPathCell != null && waypoint.cell === finalPathCell) ||
            (enteringBuilding != null && waypoint.cell === enteringBuilding.geometry.doorCell);

          if (
            waypoint.cell !== currentCell &&
            !this.bridge.attemptCharacterStep(character.id, currentCell, waypoint.cell)
          ) {
            if (!softSharedEntry) {
              const failures = (this.claimFailCounts.get(character.id) ?? 0) + 1;
              this.claimFailCounts.set(character.id, failures);
              if (failures < KingdomMapScene.MAX_CLAIM_FAILS_BEFORE_REPATH) {
                this.time.delayedCall(
                  scalaDurataRealeMs(
                    KingdomMapScene.CLAIM_RETRY_MS,
                    getOrologioGiocoVelocitaSnapshot()
                  ),
                  () => moveNext(index)
                );
                return;
              }
              this.claimFailCounts.delete(character.id);
              this.setCharacterIdleFrame(animatedView, character);
              this.bridge.blockCharacterPath(character.id, currentCell, waypoint.cell);
              return;
            }
          }

          this.claimFailCounts.delete(character.id);
          const direction = this.directionForStep(currentCell, waypoint.cell, snapshot.cols, animatedView.direction);
          const nextCell = waypoint.cell;
          const tween = this.tweens.add({
            targets: animatedView.root,
            x: waypoint.x,
            y: waypoint.y,
            duration: characterStepDurationMs(animatedView.root.x, animatedView.root.y, waypoint.x, waypoint.y),
            ease: "Linear",
            onUpdate: () => this.updateCharacterDepth(animatedView.root),
            onStart: () => {
              if (!this.isActiveCharacterView(animatedView, character.id, pathToken)) {
                tween.stop();
                return;
              }
              const directionName = this.directionName(direction);
              if (animatedView.usesLpc && character.characterAppearance) {
                const layers = resolveCharacterLayers(character.characterAppearance, "walk");
                animatedView.sprites.forEach((layerSprite, layerIndex) => {
                  if (!layerSprite?.active) return;
                  const layer = layers[layerIndex];
                  if (!layer || !this.textures.exists(layer.sourceId)) {
                    layerSprite.setVisible(false);
                    return;
                  }
                  layerSprite.setVisible(true);
                  this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName, snapshot.cellSize, character.characterAppearance?.bodyType ?? "male");
                });
              } else {
                animatedView.sprite.play(`${animatedView.sprite.texture.key}-walk-${directionName}`, true);
              }
              animatedView.direction = direction;
            },
            onComplete: () => {
              if (!this.isActiveCharacterView(animatedView, character.id, pathToken)) return;
              currentCell = nextCell;
              animatedView.logicalCell = nextCell;
              moveNext(index + 1);
            }
          });
          void tween;
        };

        moveNext(0);
      }
    }
    this.worldLayer.sort("depth");
    this.characterVisibilityDirty = true;
    this.renderSelectionMarker(snapshot);
  }

  private stopIdleRoam(characterId: number): void {
    this.abortChatFor(characterId);
    const timer = this.idleRoamTimers.get(characterId);
    if (timer) timer.remove(false);
    this.idleRoamTimers.delete(characterId);
  }

  private ensureIdleRoamScheduled(characterId: number): void {
    if (this.idleRoamTimers.has(characterId) || this.chatBusy.has(characterId)) return;
    const delay = scalaDurataRealeMs(
      KingdomMapScene.IDLE_ROAM_PAUSE_MS,
      getOrologioGiocoVelocitaSnapshot()
    );
    const timer = this.time.delayedCall(delay, () => {
      this.idleRoamTimers.delete(characterId);
      const snapshot = this.bridge.getSnapshot();
      if (isPhaserSimulationPaused(snapshot)) {
        this.ensureIdleRoamScheduled(characterId);
        return;
      }
      const character = snapshot.characters.find((c) => c.id === characterId);
      const view = this.characterViews.get(characterId);
      if (!character?.idleRoamAllowed || !view?.root?.active || (character.path?.length ?? 0) >= 2 || this.chatBusy.has(characterId)) return;
      const nearby = snapshot.characters
        .filter((other) => {
          if (other.id === characterId || !other.idleRoamAllowed || (other.path?.length ?? 0) >= 2 || this.chatBusy.has(other.id)) return false;
          const otherView = this.characterViews.get(other.id);
          if (!otherView?.root?.active) return false;
          const aCol = view.logicalCell % snapshot.cols, aRow = Math.floor(view.logicalCell / snapshot.cols);
          const bCol = otherView.logicalCell % snapshot.cols, bRow = Math.floor(otherView.logicalCell / snapshot.cols);
          const distance = Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
          return distance >= 1 && distance <= 3;
        })
        .sort((a, b) => {
          const aView = this.characterViews.get(a.id)!;
          const bView = this.characterViews.get(b.id)!;
          const fromCol = view.logicalCell % snapshot.cols, fromRow = Math.floor(view.logicalCell / snapshot.cols);
          const aDistance = Math.abs(fromCol - (aView.logicalCell % snapshot.cols)) + Math.abs(fromRow - Math.floor(aView.logicalCell / snapshot.cols));
          const bDistance = Math.abs(fromCol - (bView.logicalCell % snapshot.cols)) + Math.abs(fromRow - Math.floor(bView.logicalCell / snapshot.cols));
          return aDistance - bDistance;
        })[0];
      const pairKey = nearby ? [characterId, nearby.id].sort((a, b) => a - b).join(":") : null;
      const pairCooldownUntil = pairKey != null ? (this.chatPairCooldownUntil.get(pairKey) ?? 0) : 0;
      const pairOnCooldown = pairCooldownUntil > this.time.now;
      if (pairKey && pairCooldownUntil > 0 && !pairOnCooldown) this.chatPairCooldownUntil.delete(pairKey);
      if (nearby && !pairOnCooldown) {
        const otherView = this.characterViews.get(nearby.id);
        if (otherView) {
          const aCol = view.logicalCell % snapshot.cols, aRow = Math.floor(view.logicalCell / snapshot.cols);
          const bCol = otherView.logicalCell % snapshot.cols, bRow = Math.floor(otherView.logicalCell / snapshot.cols);
          const distance = Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
          if (distance > 1 && Math.random() < 0.35) {
            const approachCandidates: number[] = [];
            if (bCol !== aCol) approachCandidates.push(aRow * snapshot.cols + aCol + Math.sign(bCol - aCol));
            if (bRow !== aRow) approachCandidates.push((aRow + Math.sign(bRow - aRow)) * snapshot.cols + aCol);
            const destination = approachCandidates.find((cell) => {
              const occupied = [...this.characterViews.entries()].some(([id, candidate]) => id !== characterId && candidate.logicalCell === cell);
              const doorway = snapshot.buildings.some((building) =>
                isGeometryEntryCell(building.geometry, cell)
              );
              return !occupied && !doorway && this.bridge.attemptCharacterIdleStep(characterId, view.logicalCell, cell);
            });
            if (destination == null) {
              this.ensureIdleRoamScheduled(characterId);
              return;
            }
            const pos = this.characterPosition(destination, snapshot);
            view.direction = this.directionForStep(view.logicalCell, destination, snapshot.cols, view.direction);
            if (view.usesLpc && character.characterAppearance) {
              const layers = resolveCharacterLayers(character.characterAppearance, "walk");
              const directionName = this.directionName(view.direction);
              view.sprites.forEach((layerSprite, layerIndex) => {
                const layer = layers[layerIndex];
                if (!layer || !this.textures.exists(layer.sourceId)) { layerSprite.setVisible(false); return; }
                layerSprite.setVisible(true);
                this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName, snapshot.cellSize, character.characterAppearance?.bodyType ?? "male");
              });
            }
            this.chatBusy.add(characterId);
            this.tweens.add({ targets: view.root, x: pos.x, y: pos.y, duration: characterStepDurationMs(view.root.x, view.root.y, pos.x, pos.y), ease: "Linear", onUpdate: () => this.updateCharacterDepth(view.root), onComplete: () => { view.logicalCell = destination; this.chatBusy.delete(characterId); this.setCharacterIdleFrame(view, character); this.ensureIdleRoamScheduled(characterId); } });
            return;
          }
        }
      }
      if (nearby && !pairOnCooldown && Math.random() < 0.35 && !this.chatBusy.has(characterId) && !this.chatBusy.has(nearby.id)) {
        const otherView = this.characterViews.get(nearby.id);
        if (otherView) {
          view.direction = this.directionForStep(view.logicalCell, otherView.logicalCell, snapshot.cols, view.direction);
          otherView.direction = this.directionForStep(otherView.logicalCell, view.logicalCell, snapshot.cols, otherView.direction);
          const otherCharacter = snapshot.characters.find((c) => c.id === nearby.id);
          this.setCharacterIdleFrame(view, character);
          if (otherCharacter) this.setCharacterIdleFrame(otherView, otherCharacter);
          this.stopIdleRoam(nearby.id);
          this.chatBusy.add(characterId);
          this.chatBusy.add(nearby.id);
          this.chatPartnerById.set(characterId, nearby.id);
          this.chatPartnerById.set(nearby.id, characterId);
          this.bridge.notifyCharacterChatChange(characterId, nearby.id);
          this.bridge.notifyCharacterChatChange(nearby.id, characterId);
          this.startChatTalkTimer(characterId, nearby.id);
          return;
        }
      }
      const dirs: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
      view.direction = dirs[Math.floor(Math.random() * dirs.length)] ?? view.direction;
      if (Math.random() < 0.3) {
        const col = view.logicalCell % snapshot.cols;
        const row = Math.floor(view.logicalCell / snapshot.cols);
        const candidates = [row + 1 < snapshot.rows ? view.logicalCell + snapshot.cols : null, col > 0 ? view.logicalCell - 1 : null, col + 1 < snapshot.cols ? view.logicalCell + 1 : null, row > 0 ? view.logicalCell - snapshot.cols : null].filter((cell): cell is number => cell != null);
        const freeCandidates = candidates.filter((cell) => {
          const occupied = [...this.characterViews.entries()].some(([id, candidate]) => id !== characterId && candidate.logicalCell === cell);
          const doorway = snapshot.buildings.some((building) =>
            isGeometryEntryCell(building.geometry, cell)
          );
          return !occupied && !doorway;
        });
        for (let i = freeCandidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [freeCandidates[i], freeCandidates[j]] = [freeCandidates[j], freeCandidates[i]];
        }
        const destination = freeCandidates.find((cell) => this.bridge.attemptCharacterIdleStep(characterId, view.logicalCell, cell));
        if (destination != null) {
          const pos = this.characterPosition(destination, snapshot);
          view.direction = this.directionForStep(view.logicalCell, destination, snapshot.cols, view.direction);
          if (view.usesLpc && character.characterAppearance) {
            const layers = resolveCharacterLayers(character.characterAppearance, "walk");
            const directionName = this.directionName(view.direction);
            view.sprites.forEach((layerSprite, layerIndex) => {
              const layer = layers[layerIndex];
              if (!layer || !this.textures.exists(layer.sourceId)) { layerSprite.setVisible(false); return; }
              layerSprite.setVisible(true);
              this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName, snapshot.cellSize, character.characterAppearance?.bodyType ?? "male");
            });
          }
          this.chatBusy.add(characterId);
          this.tweens.add({ targets: view.root, x: pos.x, y: pos.y, duration: characterStepDurationMs(view.root.x, view.root.y, pos.x, pos.y), ease: "Linear", onUpdate: () => this.updateCharacterDepth(view.root), onComplete: () => { view.logicalCell = destination; this.chatBusy.delete(characterId); this.setCharacterIdleFrame(view, character); this.ensureIdleRoamScheduled(characterId); } });
          // Mantiene attiva la camminata fino al completamento del tween.
          return;
        }
      }
      if (view.usesLpc && character.characterAppearance) {
        const layers = resolveCharacterLayers(character.characterAppearance, "idle");
        const directionName = this.directionName(view.direction);
        const size = getLpcVisualGeometry(snapshot.cellSize, character.characterAppearance.bodyType, LPC_VISUAL_MODE);
        view.sprites.forEach((layerSprite, index) => {
          const layer = layers[index];
          if (layer && this.textures.exists(layer.sourceId)) {
            layerSprite.anims.stop();
            layerSprite.setTexture(layer.sourceId).setFrame(lpcFrameForRow(LPC_DIRECTION_ROWS[directionName], layer.sheet.columns)).setDisplaySize(size.width, size.height);
          }
        });
      } else view.sprite.stop().setFrame(view.direction);
      this.ensureIdleRoamScheduled(characterId);
    });
    this.idleRoamTimers.set(characterId, timer);
  }

  private clearLocateArrow(): void {
    if (this.locateArrow) {
      const bob = this.locateArrow.getAt(0) as Phaser.GameObjects.GameObject | undefined;
      if (bob) this.tweens.killTweensOf(bob);
      this.locateArrow.destroy(true);
      this.locateArrow = null;
    }
    this.locateAbitanteId = null;
    this.locateCell = null;
    this.locateBuildingAnchor = null;
    this.lastLocateCameraCullPosition = null;
  }

  /**
   * Durante la navigazione mobile Phaser può perdere pointerup mentre una
   * Pressable dell'edificio prende il controllo. Non ricreiamo la mappa:
   * azzeriamo solo il trascinamento e riabilitiamo l'input della scena.
   */
  private resumeInteractionAfterFocus(): void {
    this.dragPointerId = null;
    this.dragged = false;
    this.hoveredCell = null;
    this.input.enabled = true;
    this.input.resetPointers();
    this.bridge.setDragging(false);
    this.bridge.hoverCell(null);
  }

  private refreshViewportAfterFocus(): void {
    const snapshot = this.bridge.getSnapshot();
    const parent = this.scale.parentSize;
    if (parent.width > 0 && parent.height > 0) {
      if (parent.width >= 2 && parent.height >= 2 &&
          (this.scale.width !== parent.width || this.scale.height !== parent.height)) {
        this.scale.resize(parent.width, parent.height);
      }
    }
    this.configureTextureFrames(snapshot);
    this.renderedRevision = -1;
    this.renderSnapshot(snapshot);
    this.characterVisibilityDirty = true;
    this.waterViewportDirty = true;
    this.staticTileVisibilityDirty = true;
  }

  private centerCameraOnCell(cell: number, options?: { zoomIn?: boolean }): void {
    const snapshot = this.bridge.getSnapshot();
    if (cell < 0 || cell >= snapshot.cols * snapshot.rows) return;
    const camera = this.cameras.main;
    if (options?.zoomIn !== false) {
      camera.setZoom(Math.max(camera.zoom, 1.35));
    }
    camera.centerOn(
      (cell % snapshot.cols + 0.5) * snapshot.cellSize,
      (Math.floor(cell / snapshot.cols) + 0.5) * snapshot.cellSize
    );
    this.characterVisibilityDirty = true;
    this.waterViewportDirty = true;
    this.staticTileVisibilityDirty = true;
  }

  private renderLocateMarker(snapshot: PhaserMapSnapshot): void {
    if (!this.locateLayer) return;
    const marker = snapshot.locateMarker ?? null;
    if (!marker) {
      this.clearLocateArrow();
      return;
    }

    const changedTarget =
      this.locateArrow == null || this.locateAbitanteId !== marker.abitanteId;

    if (changedTarget) {
      this.clearLocateArrow();
      this.locateAbitanteId = marker.abitanteId;
      this.locateCell = marker.cell;
      this.locateBuildingAnchor = marker.buildingAnchor ?? null;

      const root = this.add.container(0, 0);
      const bob = this.add.container(0, 0);
      bob.add(
        this.add
          .text(0, 0, "▼", {
            fontSize: `${Math.round(snapshot.cellSize * 0.72)}px`,
            color: "#facc15",
            stroke: "#422006",
            strokeThickness: 4
          })
          .setOrigin(0.5, 0.85)
      );
      root.add(bob);
      this.locateLayer.add(root);
      this.locateArrow = root;
      this.tweens.add({
        targets: bob,
        y: -10,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.centerCameraOnCell(marker.cell);
    } else {
      this.locateCell = marker.cell;
      this.locateBuildingAnchor = marker.buildingAnchor ?? null;
    }

    this.syncLocateArrowPosition(snapshot.cellSize);
  }

  private syncLocateArrowPosition(cellSize: number): LocateTrackingPosition | null {
    if (!this.locateArrow || this.locateCell == null) return null;
    const snapshot = this.bridge.getSnapshot();
    const view =
      this.locateAbitanteId != null ? this.characterViews.get(this.locateAbitanteId) : undefined;
    const animatedPosition = view?.root?.active
      ? { x: view.root.x, y: view.root.y }
      : null;
    const target = resolveLocateTrackingPosition(
      animatedPosition,
      this.locateCell,
      snapshot.cols,
      cellSize,
      snapshot.buildings,
      this.renderedRoofTopByAnchor,
      this.locateBuildingAnchor
    );
    this.locateArrow.setPosition(target.arrow.x, target.arrow.y);
    return target;
  }

  /** Segue i tween reali (anche mentre cammina tra due celle), non soltanto i passi logici. */
  private followLocatedCharacter(position: { x: number; y: number }, cellSize: number): void {
    // Il trascinamento manuale disattiva Individua dalla callback React.
    // Non contrastarlo durante il breve intervallo prima del nuovo snapshot.
    if (this.dragPointerId != null) return;
    const camera = this.cameras.main;
    const beforeX = camera.scrollX;
    const beforeY = camera.scrollY;
    camera.centerOn(position.x, position.y);
    if (Math.abs(camera.scrollX - beforeX) < 0.1 && Math.abs(camera.scrollY - beforeY) < 0.1) return;

    // Evita il ricalcolo di migliaia di tile a ogni frame su smartphone.
    // Il culling usa un margine esterno alla camera e può aggiornarsi ogni
    // mezza cella, mentre la telecamera segue il personaggio fluidamente.
    const previous = this.lastLocateCameraCullPosition;
    if (!previous || Math.abs(position.x - previous.x) + Math.abs(position.y - previous.y) >= cellSize * 0.5) {
      this.staticTileVisibilityDirty = true;
      this.characterVisibilityDirty = true;
      this.waterViewportDirty = true;
      this.lastLocateCameraCullPosition = { ...position };
    }
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

  private directionForStep(
    from: number,
    to: number,
    cols: number,
    fallback: 0 | 1 | 2 | 3
  ): 0 | 1 | 2 | 3 {
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
    this.renderedRoofTopByAnchor.clear();

    for (const building of snapshot.buildings) {
      const col = building.anchor % snapshot.cols;
      const row = Math.floor(building.anchor / snapshot.cols);
      const x = col * snapshot.cellSize;
      const y = row * snapshot.cellSize;
      const width = building.widthCells * snapshot.cellSize;
      const height = building.heightCells * snapshot.cellSize;
      const colors = BUILDING_COLORS[building.category];

      // Base sotto i personaggi; overlay ordinato sulla Y di profondità dell'edificio.
      const base = this.add
        .container(x, y)
        .setDepth(worldDepthForY((row + 0.05) * snapshot.cellSize));
      const overlay = this.add
        .container(x, y)
        .setDepth(worldDepthForY(building.geometry.depthOrigin.y * snapshot.cellSize));
      this.buildingViews.push(base, overlay);
      this.worldLayer.add([base, overlay]);

      if (building.underConstruction) {
        this.renderCantiereBuilding(base, overlay, width, height, snapshot.cellSize, building);
        continue;
      }

      if (building.name === "Bosco") {
        // Il Bosco rimane un edificio 5×5 nei salvataggi, ma la grafica
        // diventa una fascia continua lungo tutto il bordo settentrionale.
        const northernRow = 0;
        base.setPosition(0, northernRow * snapshot.cellSize);
        overlay.setPosition(0, northernRow * snapshot.cellSize);
        base.setDepth(worldDepthForY((northernRow + 0.05) * snapshot.cellSize));
        // La foresta è dietro agli edifici della costa, non copre le loro facciate.
        overlay.setDepth(worldDepthForY((northernRow + 1.8) * snapshot.cellSize));
        this.renderBoscoBuilding(base, overlay, snapshot.cols * snapshot.cellSize, 5 * snapshot.cellSize, snapshot.cellSize);
        continue;
      }

      if (building.name === "Ponte") {
        this.renderWoodenBridge(base, overlay, width, height, snapshot.cellSize);
        continue;
      }

      if (building.artKey) {
        const image = this.add.image(width / 2, height, building.artKey).setOrigin(0.5, 1);
        const scale = Math.min(
          (width * 1.12) / image.width,
          (height + snapshot.cellSize * 0.75) / image.height
        );
        image.setScale(scale);
        // La dimensione reale dell'immagine è spesso superiore al footprint.
        // Registriamo il bordo superiore DOPO la scalatura; sarà usato per
        // posizionare "Individua" sopra il tetto visibile, non sulla facciata.
        this.renderedRoofTopByAnchor.set(building.anchor, y + height - image.displayHeight);

        const shadow = this.add.ellipse(
          width / 2 + 2,
          height - 2,
          width * 0.82,
          snapshot.cellSize * 0.3,
          0x000000,
          0.25
        );
        base.add([shadow, image]);

        // Se non esiste un overlay dedicato, usa la parte alta dell'immagine originale.
        const overlayKey = `${building.artKey}-overlay`;
        const hasDedicatedOverlay = this.textures.exists(overlayKey);
        const overlayImage = this.add
          .image(width / 2, height, hasDedicatedOverlay ? overlayKey : building.artKey)
          .setOrigin(0.5, 1)
          .setScale(scale);
        if (!hasDedicatedOverlay) {
          const source = overlayImage.texture.getSourceImage() as { width: number; height: number };
          overlayImage.setCrop(0, 0, source.width, source.height * 0.62);
        }
        overlay.add(overlayImage);

        const doorwayKey = `${building.artKey}-doorway`;
        if (this.textures.exists(doorwayKey)) {
          base.add(
            this.add
              .image(
                (building.geometry.doorway.col - col + building.geometry.doorway.width / 2) *
                  snapshot.cellSize,
                height,
                doorwayKey
              )
              .setOrigin(0.5, 1)
              .setScale(scale)
          );
        }

        const label = this.add
          .text(width / 2, height - 3, building.name, {
            fontFamily: "Arial, sans-serif",
            fontSize: `${Math.max(8, snapshot.cellSize * 0.22)}px`,
            color: "#ffffff",
            backgroundColor: "rgba(2,6,23,0.72)",
            padding: { x: 3, y: 1 }
          })
          .setOrigin(0.5, 1);
        overlay.add(label);
        continue;
      }

      const shadow = this.add
        .rectangle(width / 2 + 3, height / 2 + 4, width - 5, height - 5, 0x000000, 0.28)
        .setOrigin(0.5);
      const body = this.add
        .rectangle(width / 2, height / 2, width - 6, height - 8, colors.fill, 1)
        .setStrokeStyle(2, colors.border, 1);
      base.add([shadow, body]);

      const roof = this.add
        .rectangle(
          width / 2,
          Math.max(7, height * 0.2),
          width - 3,
          Math.max(10, height * 0.32),
          colors.roof,
          1
        )
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
      overlay.add([roof, emoji, label]);
    }

    this.worldLayer.sort("depth");
  }

  /** Ponte basso in legno: assi, traverse e parapetti senza coprire il fiume. */
  private renderWoodenBridge(
    base: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Container,
    width: number,
    height: number,
    cellSize: number
  ): void {
    const g = this.add.graphics();
    const margin = Math.max(2, Math.round(cellSize * 0.08));
    const deckTop = margin + Math.round(cellSize * 0.17);
    const deckH = height - deckTop - margin;

    g.fillStyle(0x1c120b, 0.35).fillRoundedRect(margin + 2, deckTop + 3, width - margin * 2, deckH, 2);
    g.fillStyle(0x5a351d, 1).fillRoundedRect(margin, deckTop, width - margin * 2, deckH, 2);
    g.lineStyle(1, 0x2b190e, 1).strokeRoundedRect(margin, deckTop, width - margin * 2, deckH, 2);

    const plankCount = 6;
    const plankW = (width - margin * 2) / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const x = margin + i * plankW;
      g.fillStyle(i % 2 === 0 ? 0xa76636 : 0x8b4f29, 1).fillRect(x + 1, deckTop + 2, plankW - 1, deckH - 4);
      g.lineStyle(1, 0x4a2a16, 0.85).lineBetween(x, deckTop + 1, x, deckTop + deckH - 1);
      g.fillStyle(0xd6a060, 0.7).fillCircle(x + plankW * 0.5, deckTop + 5, 1);
      g.fillStyle(0x2c1a10, 0.9).fillCircle(x + plankW * 0.5, deckTop + deckH - 5, 1);
    }

    g.fillStyle(0x3b2415, 1).fillRect(margin, deckTop + 2, width - margin * 2, 3);
    g.fillStyle(0x3b2415, 1).fillRect(margin, deckTop + deckH - 5, width - margin * 2, 3);
    base.add(g);

    const rail = this.add.graphics();
    rail.lineStyle(3, 0x4a2a16, 1);
    rail.lineBetween(margin, deckTop, width - margin, deckTop);
    rail.lineBetween(margin, deckTop + deckH, width - margin, deckTop + deckH);
    rail.lineStyle(1, 0xc4864c, 1);
    rail.lineBetween(margin, deckTop - 1, width - margin, deckTop - 1);
    for (let i = 0; i <= 4; i++) {
      const x = margin + ((width - margin * 2) * i) / 4;
      rail.fillStyle(0x6b3d21, 1).fillRect(x - 2, deckTop - 4, 4, 8);
      rail.fillRect(x - 2, deckTop + deckH - 4, 4, 8);
    }
    overlay.add(rail);
  }

  /** Foresta settentrionale: una singola texture pixel-art per centinaia di chiome.
   * Il 5x5 nei salvataggi identifica il luogo di raccolta; la fascia e' solo grafica.
   */
  private renderBoscoBuilding(
    base: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Container,
    width: number,
    _height: number,
    cellSize: number
  ): void {
    const treeKeys = ["northern-forest-tree-0", "northern-forest-tree-1"];
    const textureHeight = Math.ceil(6 * cellSize);
    const cacheKey = "northern-forest-grid-v4-compact-" + Math.ceil(width) + "-" + textureHeight;
    const ready = treeKeys.every(key => this.textures.exists(key));
    const trees = layoutNorthernForestTrees(width, cellSize);
    if (ready && !this.textures.exists(cacheKey)) {
      const texture = this.textures.createCanvas(cacheKey, Math.ceil(width), textureHeight);
      if (!texture) return;
      const ctx = texture.getContext();
      ctx.clearRect(0, 0, Math.ceil(width), textureHeight);
      ctx.imageSmoothingEnabled = false;
      // Sagome pixel-art riconoscibili: una casella per ogni albero,
      // nessun offset casuale e nessuna chioma sovrapposta a quella vicina.
      const pixelTrees = treeKeys.map((key) => {
        const small = document.createElement("canvas");
        small.width = 30;
        small.height = 45;
        const smallCtx = small.getContext("2d");
        if (smallCtx) {
          smallCtx.imageSmoothingEnabled = true;
          smallCtx.drawImage(this.textures.get(key).getSourceImage() as CanvasImageSource, 0, 0, small.width, small.height);
        }
        const bounds = smallCtx
          ? ritaglioAlphaAlbero(smallCtx.getImageData(0, 0, small.width, small.height).data, small.width, small.height)
          : { x: 0, y: 0, width: small.width, height: small.height };
        return { image: small, bounds };
      });
      for (const tree of trees) {
        const source = pixelTrees[tree.variante];
        const { x, y, width: cropW, height: cropH } = source.bounds;
        ctx.drawImage(source.image, x, y, cropW, cropH, tree.x, tree.y, tree.width, tree.height);
      }
      texture.refresh();
    }
    if (ready) {
      overlay.add(this.add.image(0, 0, cacheKey).setOrigin(0, 0));
      return;
    }
    // Fallback pixel-art ordinato, usando le stesse coordinate senza sovrapposizioni.
    const g = this.add.graphics();
    for (const tree of trees) {
      const x = tree.x + tree.width / 2;
      const y = tree.y + tree.height;
      g.fillStyle(tree.variante === 0 ? 0x166534 : 0x15803d, 1);
      g.fillTriangle(x, tree.y, tree.x, y - cellSize * 0.12, tree.x + tree.width, y - cellSize * 0.12);
      g.fillStyle(0x6b4423, 1).fillRect(x - tree.width * 0.08, y - cellSize * 0.24, tree.width * 0.16, cellSize * 0.24);
    }
    base.add(g);
  }

  /** Cantiere con avanzamento percentuale. */
  private renderCantiereBuilding(
    base: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Container,
    width: number,
    height: number,
    cellSize: number,
    building: PhaserMapBuilding
  ): void {
    const prog = Math.max(0, Math.min(100, building.progressoCostruzione ?? 0));
    const shadow = this.add
      .rectangle(width / 2 + 2, height / 2 + 3, width - 4, height - 4, 0x000000, 0.22)
      .setOrigin(0.5);
    const body = this.add
      .rectangle(width / 2, height / 2, width - 4, height - 6, 0x78716c, 1)
      .setStrokeStyle(2, 0x44403c, 1);
    const roof = this.add
      .rectangle(
        width / 2,
        Math.max(6, height * 0.18),
        width - 2,
        Math.max(8, height * 0.28),
        0xf59e0b,
        0.9
      )
      .setStrokeStyle(2, 0xb45309, 1);
    const emoji = this.add
      .text(width / 2, height * 0.48, building.emoji || "🏗️", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.max(16, Math.min(32, cellSize * 0.7))}px`
      })
      .setOrigin(0.5);

    const trackW = Math.max(14, width - 6);
    const trackH = Math.max(5, Math.floor(cellSize * 0.14));
    const trackY = -trackH - 3;
    const track = this.add
      .rectangle(width / 2, trackY, trackW, trackH, 0x1c1917, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x44403c, 1);
    const fillW = Math.max(2, (trackW - 2) * (prog / 100));
    const fill = this.add
      .rectangle(width / 2 - trackW / 2 + 1 + fillW / 2, trackY, fillW, trackH - 2, 0x4ade80, 1)
      .setOrigin(0.5);
    const label = this.add
      .text(width / 2, trackY, `${prog}%`, {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.max(9, Math.min(12, cellSize * 0.28))}px`,
        color: "#f8fafc"
      })
      .setOrigin(0.5);

    base.add([shadow, body, emoji]);
    overlay.add([roof, track, fill, label]);
  }

  update(time: number, delta: number): void {
    if (this.locateArrow) {
      const cellSize = this.bridge.getSnapshot().cellSize;
      const tracking = this.syncLocateArrowPosition(cellSize);
      if (tracking) this.followLocatedCharacter(tracking.focus, cellSize);
    }
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
    // All'avvio mostra il nucleo del regno, anche con tessere 64x64.
    camera.setZoom(this.scale.width <= MOBILE_VIEWPORT_MAX_WIDTH ? MOBILE_INITIAL_CAMERA_ZOOM : 1);
    const initialMap = this.bridge.getSnapshot();
    camera.centerOn(initialMap.cols * initialMap.cellSize / 2, initialMap.rows * initialMap.cellSize / 2);
    // Il culling era stato calcolato prima del riposizionamento della camera.
    this.staticTileVisibilityDirty = true;
    this.characterVisibilityDirty = true;
    this.waterViewportDirty = true;

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
