import Phaser from "phaser";

import { isGeometryEntryCell } from "../../game/buildingGeometry";
import { OVERWORLD_SHEET_PX } from "../../game/overworldSpritesheetLayout";
import type { MapSceneBridge, PhaserMapBuilding, PhaserMapCharacter, PhaserMapSnapshot } from "../adapters/mapSceneBridge";
import { CHILD_BEARD_OFFSET_Y_PX, LPC_DIRECTION_ROWS } from "../../character-system/lpcPack";
import { canRenderCharacter, resolveCharacterLayers } from "../../character-system/registry";
import {
  getOrologioSimTimeScaleSnapshot,
  getOrologioGiocoInPausaSnapshot,
  getOrologioGiocoVelocitaSnapshot,
  scalaDurataRealeMs,
  subscribeOrologioGiocoInPausa,
  subscribeOrologioGiocoVelocita
} from "../../game/orologioGiocoSession";
import { orthogonalNeighbors } from "../../game/mappaPathfinding";
import { scrollKeepingPointerAnchor } from "../../game/pointerZoom";

const SHEET_KEY = "overworld";
const GOLEM_KEY = "stone-golem";
const TILE_LAYER_DEPTH = 0;
const INTERACTION_LAYER_DEPTH = 30;
const LOCATE_LAYER_DEPTH = 220;
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
  golem: string;
  getLpcLayerUrl: (sourceId: string) => string | undefined;
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
  /** Cella logica corrente (anche dopo passi idle). */
  logicalCell: number;
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
  private locateLayer: Phaser.GameObjects.Container | null = null;
  private locateArrow: Phaser.GameObjects.Container | null = null;
  private locateAbitanteId: number | null = null;
  private locateCell: number | null = null;
  /** Cerchio verde sotto il personaggio selezionato (figlio del container sprite). */
  private selectionRing: Phaser.GameObjects.Ellipse | null = null;
  private selectionAbitanteId: number | null = null;
  private gridLayer: Phaser.GameObjects.Graphics | null = null;
  private readonly characterViews = new Map<number, CharacterView>();
  private renderedRevision = -1;
  private minCameraZoom = 0.5;
  private maxCameraZoom = 3;
  private hasFittedCamera = false;
  private waterSprites: Phaser.GameObjects.Image[] = [];
  private waterFrame = 0;
  private nextWaterFrameAt = 0;
  private dragPointerId: number | null = null;
  private dragged = false;
  private hoveredCell: number | null = null;
  private readonly characterLastPressAt = new Map<number, number>();
  private lpcLoadCompleteListener: (() => void) | null = null;
  private readonly pendingLpcSourceIds = new Set<string>();
  private characterAssetsReadyNotified = false;
  private unsubscribeSimTime: (() => void) | null = null;
  private readonly claimFailCounts = new Map<number, number>();
  private static readonly MAX_CLAIM_FAILS_BEFORE_REPATH = 3;
  private static readonly CLAIM_RETRY_MS = 900;
  private readonly idleRoamTimers = new Map<number, Phaser.Time.TimerEvent>();
  private readonly idleRoamBusy = new Set<number>();
  private static readonly IDLE_ROAM_PAUSE_MS = 1600;
  private static readonly IDLE_ROAM_LOOK_MS = 900;
  private static readonly IDLE_STEP_MS = 320;
  /** Manhattan: entro questa distanza due «in giro» possono iniziare a chiacchierare. */
  private static readonly CHAT_DETECT_DIST = 3;
  /** Dopo la chiacchiera, la coppia non si riavvicina per ~4 ore di gioco. */
  private static readonly CHAT_PAIR_COOLDOWN_MS = 240_000;
  private static readonly CHAT_SEPARATE_STEPS = 4;
  /** Partner attivo della chiacchiera (se presente). */
  private readonly chatPartnerById = new Map<number, number>();
  /** Cooldown coppia: chiave "minId:maxId" → this.time.now fino a quando. */
  private readonly chatPairCooldownUntil = new Map<string, number>();
  private readonly chatTalkTimers = new Map<number, Phaser.Time.TimerEvent>();

  constructor(bridge: MapSceneBridge, sheetUrl: string, artUrls: PhaserArtAssetUrls) {
    super({ key: "kingdom-map" });
    this.bridge = bridge;
    this.sheetUrl = sheetUrl;
    this.artUrls = artUrls;
  }

  preload(): void {
    this.load.image(SHEET_KEY, this.sheetUrl);
    this.load.spritesheet(GOLEM_KEY, this.artUrls.golem, { frameWidth: 64, frameHeight: 64 });
    for (const [key, asset] of Object.entries(this.artUrls.buildings)) {
      if (typeof asset === "string") this.load.image(key, asset);
      else {
        this.load.image(key, asset.base);
        if (asset.overlay) this.load.image(`${key}-overlay`, asset.overlay);
        if (asset.doorway) this.load.image(`${key}-doorway`, asset.doorway);
      }
    }
    // Precarica i pezzi LPC degli abitanti già nello snapshot: niente placeholder colonist al primo draw.
    for (const sourceId of this.collectSnapshotLpcSourceIds(this.bridge.getSnapshot())) {
      const url = this.artUrls.getLpcLayerUrl(sourceId);
      if (!url) continue;
      this.load.spritesheet(sourceId, url, { frameWidth: 64, frameHeight: 64 });
    }
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0).setDepth(TILE_LAYER_DEPTH);
    this.worldLayer = this.add.container(0, 0).setDepth(10);
    this.buildingDebugLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH - 1);
    this.interactionLayer = this.add.container(0, 0).setDepth(INTERACTION_LAYER_DEPTH);
    this.locateLayer = this.add.container(0, 0).setDepth(LOCATE_LAYER_DEPTH);
    this.gridLayer = this.add.graphics().setDepth(INTERACTION_LAYER_DEPTH - 1);
    this.configureCharacterAnimations();
    this.configureTextureFrames(this.bridge.getSnapshot());
    this.renderSnapshot(this.bridge.getSnapshot());
    this.tryNotifyCharacterAssetsReady(this.bridge.getSnapshot());
    this.configureCameraAndInput();
    this.bridge.registerSceneControls({
      refreshViewport: () => this.refreshViewportAfterFocus(),
      centerOnCell: (cellIndex, options) => this.centerCameraOnCell(cellIndex, options)
    });
    this.scale.on("resize", () => {
      const snapshot = this.bridge.getSnapshot();
      const worldW = snapshot.cols * snapshot.cellSize;
      const worldH = snapshot.rows * snapshot.cellSize;
      // Ad ogni resize: riempi di nuovo lo schermo con la mappa di gioco.
      this.fitCameraToViewport(worldW, worldH, true);
    });
    // Dopo il primo layout del canvas, rifitta (spesso width/height partono a 0).
    this.time.delayedCall(0, () => {
      const snapshot = this.bridge.getSnapshot();
      this.fitCameraToViewport(
        snapshot.cols * snapshot.cellSize,
        snapshot.rows * snapshot.cellSize,
        true
      );
    });
    this.time.delayedCall(100, () => {
      const snapshot = this.bridge.getSnapshot();
      this.fitCameraToViewport(
        snapshot.cols * snapshot.cellSize,
        snapshot.rows * snapshot.cellSize,
        true
      );
    });
    this.unsubscribe = this.bridge.subscribe(() => {
      const snapshot = this.bridge.getSnapshot();
      if (snapshot.revision !== this.renderedRevision) this.renderSnapshot(snapshot);
      else {
        this.reconcileCharacters(snapshot);
        this.renderGrid(snapshot);
        this.renderInteraction(snapshot);
        this.renderLocateMarker(snapshot);
        this.renderSelectionMarker(snapshot);
      }
      this.tryNotifyCharacterAssetsReady(snapshot);
    });
    this.syncCharacterSimTimeScale();
    const unsubPausa = subscribeOrologioGiocoInPausa(() => this.syncCharacterSimTimeScale());
    const unsubVelocita = subscribeOrologioGiocoVelocita(() => this.syncCharacterSimTimeScale());
    this.unsubscribeSimTime = () => {
      unsubPausa();
      unsubVelocita();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bridge.registerSceneControls(null);
      this.unsubscribe?.();
      this.unsubscribeSimTime?.();
      this.unsubscribeSimTime = null;
      for (const id of [...this.idleRoamTimers.keys()]) this.stopIdleRoam(id);
      this.chatPartnerById.clear();
      this.chatPairCooldownUntil.clear();
      for (const timer of this.chatTalkTimers.values()) timer.remove(false);
      this.chatTalkTimers.clear();
      this.clearSelectionRing();
      this.clearLocateArrow();
      if (this.lpcLoadCompleteListener) {
        this.load.off(Phaser.Loader.Events.COMPLETE, this.lpcLoadCompleteListener);
        this.lpcLoadCompleteListener = null;
      }
    });
  }

  /**
   * Dopo navigazione (es. ritorno dal Castello) il canvas può restare sullo sfondo verde:
   * forza resize + ridisegno tile senza resettare lo zoom se già valido.
   */
  private refreshViewportAfterFocus(): void {
    const snapshot = this.bridge.getSnapshot();
    const worldW = snapshot.cols * snapshot.cellSize;
    const worldH = snapshot.rows * snapshot.cellSize;
    const parent = this.scale.parentSize;
    if (parent.width > 0 && parent.height > 0) {
      this.scale.resize(parent.width, parent.height);
    }
    this.configureTextureFrames(snapshot);
    // Forza ridisegno completo anche se la revision non è cambiata.
    this.renderedRevision = -1;
    this.renderSnapshot(snapshot);
    this.fitCameraToViewport(worldW, worldH, true);
  }

  private centerCameraOnCell(cellIndex: number, options?: { zoomIn?: boolean }): void {
    const snapshot = this.bridge.getSnapshot();
    if (snapshot.cols <= 0 || snapshot.rows <= 0) return;
    const maxCell = snapshot.cols * snapshot.rows - 1;
    if (cellIndex < 0 || cellIndex > maxCell) return;
    const worldW = snapshot.cols * snapshot.cellSize;
    const worldH = snapshot.rows * snapshot.cellSize;
    this.updateCameraZoomLimits(worldW, worldH);
    const camera = this.cameras.main;
    if (camera.width <= 0 || camera.height <= 0) return;
    if (options?.zoomIn !== false) {
      const focusZoom = Math.min(
        this.maxCameraZoom,
        Math.max(this.minCameraZoom * 2.4, this.minCameraZoom + 0.35)
      );
      camera.setZoom(focusZoom);
    }
    const col = cellIndex % snapshot.cols;
    const row = Math.floor(cellIndex / snapshot.cols);
    camera.centerOn(
      (col + 0.5) * snapshot.cellSize,
      (row + 0.5) * snapshot.cellSize
    );
  }

  /** Congela (pausa) o accelera (×5/×10) tween e animazioni camminata. */
  private syncCharacterSimTimeScale(): void {
    const scale = getOrologioSimTimeScaleSnapshot();
    this.tweens.timeScale = scale;
    this.anims.globalTimeScale = scale;
  }

  /** Carica on-demand solo i layer LPC visibili sulla mappa (evita ~4800 preload all'avvio). */
  private collectSnapshotLpcSourceIds(snapshot: PhaserMapSnapshot): string[] {
    const sourceIds = new Set<string>();
    for (const character of snapshot.characters) {
      if (!character.characterAppearance || !canRenderCharacter(character.characterAppearance, "idle")) continue;
      for (const sourceId of this.collectLpcSourceIds(character.characterAppearance)) sourceIds.add(sourceId);
    }
    return [...sourceIds];
  }

  private collectLpcSourceIds(appearance: NonNullable<PhaserMapCharacter["characterAppearance"]>): string[] {
    const sourceIds = new Set<string>();
    for (const animation of ["idle", "walk"] as const) {
      if (!canRenderCharacter(appearance, animation)) continue;
      for (const layer of resolveCharacterLayers(appearance, animation)) sourceIds.add(layer.sourceId);
    }
    return [...sourceIds];
  }

  private characterNeedsLpc(character: PhaserMapCharacter): boolean {
    if (!character.characterAppearance || !canRenderCharacter(character.characterAppearance, "idle")) return false;
    return this.collectLpcSourceIds(character.characterAppearance).some((id) => !!this.artUrls.getLpcLayerUrl(id));
  }

  private ensureLpcTextures(sourceIds: readonly string[]): void {
    let queued = false;
    for (const sourceId of sourceIds) {
      if (!sourceId || this.textures.exists(sourceId) || this.pendingLpcSourceIds.has(sourceId)) continue;
      const url = this.artUrls.getLpcLayerUrl(sourceId);
      if (!url) continue;
      this.pendingLpcSourceIds.add(sourceId);
      this.load.spritesheet(sourceId, url, { frameWidth: 64, frameHeight: 64 });
      queued = true;
    }
    if (!queued) return;

    if (!this.lpcLoadCompleteListener) {
      this.lpcLoadCompleteListener = () => {
        this.pendingLpcSourceIds.clear();
        if (this.worldLayer) {
          const snapshot = this.bridge.getSnapshot();
          this.reconcileCharacters(snapshot);
          this.tryNotifyCharacterAssetsReady(snapshot);
        }
      };
      this.load.on(Phaser.Loader.Events.COMPLETE, this.lpcLoadCompleteListener);
    }

    if (!this.load.isLoading()) this.load.start();
  }

  private lpcLayersReady(appearance: PhaserMapCharacter["characterAppearance"]): boolean {
    if (!appearance || !canRenderCharacter(appearance, "idle")) return false;
    const sourceIds = this.collectLpcSourceIds(appearance).filter((id) => !!this.artUrls.getLpcLayerUrl(id));
    if (sourceIds.length === 0) return false;
    return sourceIds.every((sourceId) => this.textures.exists(sourceId));
  }

  private tryNotifyCharacterAssetsReady(snapshot: PhaserMapSnapshot): void {
    if (this.characterAssetsReadyNotified) return;
    if (this.pendingLpcSourceIds.size > 0 || this.load.isLoading()) return;
    const waitingForLpc = snapshot.characters.some(
      (character) => this.characterNeedsLpc(character) && !this.lpcLayersReady(character.characterAppearance)
    );
    if (waitingForLpc) return;
    this.characterAssetsReadyNotified = true;
    this.bridge.notifyCharacterAssetsReady();
  }

  private playLpcLayerWalk(layerSprite: Phaser.GameObjects.Sprite, sourceId: string, directionName: "down" | "left" | "right" | "up"): void {
    if (!layerSprite?.active || !this.textures.exists(sourceId)) return;
    const row = LPC_DIRECTION_ROWS[directionName];
    const animationKey = `${sourceId}-walk-${directionName}`;
    if (!this.anims.exists(animationKey)) {
      this.anims.create({
        key: animationKey,
        frames: Array.from({ length: 9 }, (_, column) => ({ key: sourceId, frame: row * 9 + column })),
        frameRate: 10,
        repeat: -1
      });
    }
    if (this.anims.exists(animationKey)) layerSprite.play(animationKey, true);
  }

  private isActiveCharacterView(view: CharacterView, characterId: number, pathToken?: number): boolean {
    if (this.characterViews.get(characterId) !== view) return false;
    if (!view.root?.active) return false;
    if (pathToken != null && view.token !== pathToken) return false;
    return true;
  }

  private stopSpriteAnim(sprite: Phaser.GameObjects.Sprite | undefined): void {
    if (!sprite?.active) return;
    sprite.anims?.stop();
  }

  private setCharacterIdleFrame(view: CharacterView, character: PhaserMapCharacter): void {
    if (!view.root?.active) return;
    if (view.usesLpc) {
      const directionName = this.directionName(view.direction);
      const layers = character.characterAppearance ? resolveCharacterLayers(character.characterAppearance, "idle") : [];
      view.sprites.forEach((layerSprite, layerIndex) => {
        if (!layerSprite?.active) return;
        const layer = layers[layerIndex];
        if (!layer || !this.textures.exists(layer.sourceId)) {
          layerSprite.setVisible(false);
          return;
        }
        this.stopSpriteAnim(layerSprite);
        layerSprite.setVisible(true).setTexture(layer.sourceId).setFrame(LPC_DIRECTION_ROWS[directionName] * 2);
      });
      return;
    }
    if (!view.sprite?.active) return;
    this.stopSpriteAnim(view.sprite);
    view.sprite.setFrame(view.direction);
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
    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldW, worldH);
    // Prima volta (o dopo resize forzato): zoom “cover” così la mappa riempie lo schermo
    // senza la banda verde scura ai lati su viewport landscape.
    if (this.renderedRevision < 0 || !this.hasFittedCamera) {
      this.fitCameraToViewport(worldW, worldH, true);
    } else {
      this.updateCameraZoomLimits(worldW, worldH);
    }
    this.physics?.world?.setBounds(0, 0, worldW, worldH);
    this.renderedRevision = snapshot.revision;
    this.renderBuildings(snapshot);
    this.reconcileCharacters(snapshot);
    this.renderGrid(snapshot);
    this.renderInteraction(snapshot);
    this.renderLocateMarker(snapshot);
    this.renderSelectionMarker(snapshot);
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

  private clearSelectionRing(): void {
    if (this.selectionRing) {
      this.tweens.killTweensOf(this.selectionRing);
      if (this.selectionRing.scene) this.selectionRing.destroy();
      this.selectionRing = null;
    }
    this.selectionAbitanteId = null;
  }

  /**
   * Cerchio verde sotto i piedi del personaggio selezionato (segue lo sprite).
   * Figlio del container personaggio, così resta agganciato durante camminata/idle.
   */
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

    const s = snapshot.cellSize;
    const same =
      this.selectionRing != null &&
      this.selectionAbitanteId === id &&
      this.selectionRing.parentContainer === view.root;
    if (same) return;

    this.clearSelectionRing();
    this.selectionAbitanteId = id;
    const ring = this.add
      .ellipse(0, s * 0.25, s * 0.78, s * 0.3, 0x22c55e, 0.38)
      .setStrokeStyle(2.5, 0x86efac, 0.95);
    // Dietro sprite/layer LPC.
    view.root.addAt(ring, 0);
    this.selectionRing = ring;
    this.tweens.add({
      targets: ring,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0.55,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private clearLocateArrow(): void {
    if (this.locateArrow) {
      const bob = this.locateArrow.getAt(0) as Phaser.GameObjects.GameObject | undefined;
      if (bob) this.tweens.killTweensOf(bob);
      this.tweens.killTweensOf(this.locateArrow);
      this.locateArrow.destroy(true);
      this.locateArrow = null;
    }
    this.locateAbitanteId = null;
    this.locateCell = null;
  }

  private renderLocateMarker(snapshot: PhaserMapSnapshot): void {
    if (!this.locateLayer) return;
    const marker = snapshot.locateMarker ?? null;
    if (!marker) {
      this.clearLocateArrow();
      return;
    }

    const sameTarget = this.locateArrow != null && this.locateAbitanteId === marker.abitanteId;
    this.locateAbitanteId = marker.abitanteId;
    this.locateCell = marker.cell;

    if (!sameTarget) {
      if (this.locateArrow) {
        const bob = this.locateArrow.getAt(0) as Phaser.GameObjects.GameObject | undefined;
        if (bob) this.tweens.killTweensOf(bob);
        this.tweens.killTweensOf(this.locateArrow);
        this.locateArrow.destroy(true);
        this.locateArrow = null;
      }
      const root = this.add.container(0, 0);
      const bob = this.add.container(0, 0);
      const tip = this.add
        .text(0, 0, "▼", {
          fontSize: `${Math.round(snapshot.cellSize * 0.72)}px`,
          color: "#facc15",
          stroke: "#422006",
          strokeThickness: 4
        })
        .setOrigin(0.5, 0.85);
      bob.add(tip);
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
    }

    this.syncLocateArrowPosition(snapshot.cellSize);
  }

  private syncLocateArrowPosition(cellSize: number): void {
    if (!this.locateArrow || this.locateCell == null) return;
    const view =
      this.locateAbitanteId != null ? this.characterViews.get(this.locateAbitanteId) : undefined;
    if (view) {
      this.locateArrow.setPosition(view.root.x, view.root.y - cellSize * 0.95);
      return;
    }
    const snapshot = this.bridge.getSnapshot();
    const col = this.locateCell % snapshot.cols;
    const row = Math.floor(this.locateCell / snapshot.cols);
    this.locateArrow.setPosition(
      (col + 0.5) * cellSize,
      (row + 0.15) * cellSize
    );
  }

  private reconcileCharacters(snapshot: PhaserMapSnapshot): void {
    if (!this.worldLayer) return;

    const lpcSourceIds = this.collectSnapshotLpcSourceIds(snapshot);
    this.ensureLpcTextures(lpcSourceIds);

    const active = new Set(snapshot.characters.map((character) => character.id));
    for (const [id, view] of this.characterViews) {
      if (active.has(id)) continue;
      this.stopIdleRoam(id);
      if (this.selectionAbitanteId === id) this.clearSelectionRing();
      this.tweens.killTweensOf(view.root);
      view.root.destroy(true);
      this.characterViews.delete(id);
    }

    for (const character of snapshot.characters) {
      const token = character.pathToken ?? 0;
      let view = this.characterViews.get(character.id);
      const needsLpc = this.characterNeedsLpc(character);
      const lpcReady = needsLpc && this.lpcLayersReady(character.characterAppearance);
      // Niente sprite colonist: aspetta i pezzi LPC (o golem/emoji se non LPC).
      if (needsLpc && !lpcReady) {
        if (view) {
          this.stopIdleRoam(character.id);
          this.tweens.killTweensOf(view.root);
          view.root.destroy(true);
          this.characterViews.delete(character.id);
        }
        continue;
      }
      const shouldUseLpc = lpcReady;
      if (view && view.usesLpc !== shouldUseLpc) {
        this.stopIdleRoam(character.id);
        this.tweens.killTweensOf(view.root);
        view.root.destroy(true);
        this.characterViews.delete(character.id);
        view = undefined;
      }
      if (!view) {
        const usesLpc = shouldUseLpc;
        const idleLayers =
          usesLpc && character.characterAppearance
            ? resolveCharacterLayers(character.characterAppearance, "idle")
            : [];
        const canSpawnGolem = !usesLpc && character.appearance === "golem";
        const canSpawnEmoji = !usesLpc && !!character.markerEmoji;
        if (!usesLpc && !canSpawnGolem && !canSpawnEmoji) continue;

        const root = this.add.container(0, 0);
        const initialFrame = usesLpc ? LPC_DIRECTION_ROWS.down * 2 : 0;
        const baseTextureKey = usesLpc ? idleLayers[0]?.sourceId ?? GOLEM_KEY : GOLEM_KEY;
        const sprite = this.add
          .sprite(0, -snapshot.cellSize * 0.2, baseTextureKey, initialFrame)
          .setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08);
        const sprites =
          usesLpc && idleLayers.length > 0
            ? idleLayers.map((layer) => {
                const scale = (snapshot.cellSize * 1.08) / 64;
                const beardLift =
                  layer.layer === "beard" && character.characterAppearance?.bodyType === "child"
                    ? CHILD_BEARD_OFFSET_Y_PX * scale
                    : 0;
                return this.add
                  .sprite(0, -snapshot.cellSize * 0.2 + beardLift, layer.sourceId, initialFrame)
                  .setDisplaySize(snapshot.cellSize * 1.08, snapshot.cellSize * 1.08);
              })
            : [sprite];
        if (usesLpc) sprite.setVisible(false);
        if (canSpawnEmoji) {
          sprite.setVisible(false);
          root.add(
            this.add.text(0, -snapshot.cellSize * 0.2, character.markerEmoji!, { fontSize: "26px" }).setOrigin(0.5)
          );
        }
        root.add(sprites);
        // Nome personaggio nascosto (rimosso dalla mappa)
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
        view = { root, sprite, sprites, token: -1, direction: 0, usesLpc, logicalCell: character.cell };
        this.characterViews.set(character.id, view);
      }
      if (!view) continue;
      const hasCommutePath = (character.path?.length ?? 0) >= 2;
      if (!hasCommutePath) {
        // Idle: ripiazza solo se cambia il token (es. teleport uscita Castello via epoch).
        // Non confrontare logicalCell con character.cell: l’idle roam aggiorna solo la view.
        if (view.token !== token) {
          this.tweens.killTweensOf(view.root);
          view.token = token;
          view.logicalCell = character.cell;
          this.placeCharacter(view.root, view.logicalCell, snapshot);
          this.setCharacterIdleFrame(view, character);
        }
        if (character.idleRoamAllowed) this.ensureIdleRoamScheduled(character.id);
        else this.stopIdleRoam(character.id);
        continue;
      }
      this.stopIdleRoam(character.id);
      if (view.token === token) continue;
      this.tweens.killTweensOf(view.root);
      const start = character.path?.[0] ?? character.cell;
      const finalPathCell = character.path?.[(character.path?.length ?? 0) - 1];
      const enteringBuilding = snapshot.buildings.find((building) =>
        finalPathCell != null && isGeometryEntryCell(building.geometry, finalPathCell)
      );
      const exitingBuilding = snapshot.buildings.find((building) => {
        const f = building.geometry.footprint;
        const c = character.cell % snapshot.cols;
        const r = Math.floor(character.cell / snapshot.cols);
        const pathStart = character.path?.[0];
        return (
          pathStart != null &&
          isGeometryEntryCell(building.geometry, pathStart) &&
          c >= f.col &&
          c < f.col + f.width &&
          r >= f.row &&
          r < f.row + f.height
        );
      });
      if (exitingBuilding) {
        // Bosco (ingressi multipli): esci dalla cella path, non dallo spawn centrale.
        const uscitaMultipla = (exitingBuilding.geometry.entryPoints?.length ?? 0) > 1;
        if (uscitaMultipla) {
          this.placeCharacter(view.root, start, snapshot);
        } else {
          view.root.setPosition(
            exitingBuilding.geometry.interiorSpawnPoint.x * snapshot.cellSize,
            exitingBuilding.geometry.interiorSpawnPoint.y * snapshot.cellSize
          );
          this.updateCharacterDepth(view.root);
        }
      } else this.placeCharacter(view.root, start, snapshot);
      view.token = token;
      view.logicalCell = start;
      const path = character.path?.slice(1) ?? [];
      const waypoints = path.map((cell) => ({ ...this.characterPosition(cell, snapshot), cell }));
      const uscitaConPortaUnica =
        exitingBuilding != null && (exitingBuilding.geometry.entryPoints?.length ?? 0) <= 1;
      if (uscitaConPortaUnica && exitingBuilding) {
        waypoints.unshift({
          x: (exitingBuilding.geometry.doorway.col + exitingBuilding.geometry.doorway.width / 2) * snapshot.cellSize,
          y: (exitingBuilding.geometry.doorway.row + 0.92) * snapshot.cellSize,
          cell: exitingBuilding.geometry.doorCell
        });
      }
      // Bosco: niente waypoint verso la “porta” centrale — restano sull’ingresso sud raggiunto dal path.
      const entrataConPortaUnica =
        enteringBuilding != null && (enteringBuilding.geometry.entryPoints?.length ?? 0) <= 1;
      if (entrataConPortaUnica && enteringBuilding) {
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
            this.setCharacterIdleFrame(animatedView, character);
            this.bridge.completeCharacterPath(character.id, pathToken);
            return;
          }
          const waypoint = waypoints[index]!;
          // Soft-share sull’ultima cella d’ingresso (e porta/interior): più abitanti
          // possono condividere la porta — come MapWandererCharacter. Altrimenti restano
          // bloccati in coda e, dopo repath, l’animazione Phaser non riparte.
          const softSharedEntry =
            (finalPathCell != null && waypoint.cell === finalPathCell) ||
            (enteringBuilding != null && waypoint.cell === enteringBuilding.geometry.doorCell);
          if (waypoint.cell !== currentCell && !this.bridge.attemptCharacterStep(character.id, currentCell, waypoint.cell)) {
            if (softSharedEntry) {
              // Claim fallito ma prosegui comunque (ingresso condiviso).
            } else {
              const fails = (this.claimFailCounts.get(character.id) ?? 0) + 1;
              this.claimFailCounts.set(character.id, fails);
              if (fails < KingdomMapScene.MAX_CLAIM_FAILS_BEFORE_REPATH) {
                // Come su native: aspetta e riprova prima di ripianificare (evita oscillazione testa-a-testa).
                const retryMs = scalaDurataRealeMs(
                  KingdomMapScene.CLAIM_RETRY_MS,
                  getOrologioGiocoVelocitaSnapshot()
                );
                this.time.delayedCall(retryMs, () => {
                  if (!this.isActiveCharacterView(animatedView, character.id, pathToken)) return;
                  moveNext(index);
                });
                return;
              }
              this.claimFailCounts.set(character.id, 0);
              this.setCharacterIdleFrame(animatedView, character);
              this.bridge.blockCharacterPath(character.id, currentCell, waypoint.cell);
              return;
            }
          }
          this.claimFailCounts.set(character.id, 0);
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
                    layerSprite.setVisible(true).setTexture(layer.sourceId);
                    this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName);
                  });
                } else if (animatedView.sprite?.active) {
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
  }

  /** Ferma timer e stato busy dell’idle roam (commute, hide, shutdown). */
  private stopIdleRoam(characterId: number): void {
    this.abortChatFor(characterId);
    const timer = this.idleRoamTimers.get(characterId);
    if (timer) {
      timer.remove(false);
      this.idleRoamTimers.delete(characterId);
    }
    this.idleRoamBusy.delete(characterId);
  }

  private clearIdleRoamTimer(characterId: number): void {
    const timer = this.idleRoamTimers.get(characterId);
    if (timer) {
      timer.remove(false);
      this.idleRoamTimers.delete(characterId);
    }
  }

  private ensureIdleRoamScheduled(characterId: number): void {
    if (this.idleRoamTimers.has(characterId) || this.idleRoamBusy.has(characterId)) return;
    if (this.chatPartnerById.has(characterId)) return;
    const character = this.bridge.getSnapshot().characters.find((c) => c.id === characterId);
    if (!character?.idleRoamAllowed) return;
    this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_PAUSE_MS);
  }

  private scheduleIdleRoamAfter(characterId: number, baseMs: number): void {
    this.clearIdleRoamTimer(characterId);
    const delay = scalaDurataRealeMs(
      baseMs * (0.7 + Math.random() * 0.7),
      getOrologioGiocoVelocitaSnapshot()
    );
    const timer = this.time.delayedCall(delay, () => {
      this.idleRoamTimers.delete(characterId);
      this.runIdleRoamTick(characterId);
    });
    this.idleRoamTimers.set(characterId, timer);
  }

  private chatPairKey(a: number, b: number): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  private manhattanCells(a: number, b: number, cols: number): number {
    return Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
  }

  private isChatPairOnCooldown(a: number, b: number): boolean {
    const until = this.chatPairCooldownUntil.get(this.chatPairKey(a, b));
    return until != null && this.time.now < until;
  }

  /** Cella subito davanti a una porta (entryPoint / entryPoints): la chiacchiera non deve mai fermarsi qui. */
  private isBuildingDoorEntryCell(cell: number, snapshot: PhaserMapSnapshot): boolean {
    return snapshot.buildings.some((building) => isGeometryEntryCell(building.geometry, cell));
  }

  private chatWouldBlockDoorway(cellA: number, cellB: number, snapshot: PhaserMapSnapshot): boolean {
    return this.isBuildingDoorEntryCell(cellA, snapshot) || this.isBuildingDoorEntryCell(cellB, snapshot);
  }

  private abortChatFor(characterId: number): void {
    const partnerId = this.chatPartnerById.get(characterId);
    if (partnerId == null) {
      const talk = this.chatTalkTimers.get(characterId);
      if (talk) {
        talk.remove(false);
        this.chatTalkTimers.delete(characterId);
      }
      return;
    }
    this.clearChatTalkTimer(characterId);
    this.clearChatTalkTimer(partnerId);
    this.chatPartnerById.delete(characterId);
    this.chatPartnerById.delete(partnerId);
    this.bridge.notifyCharacterChatChange(characterId, null);
    this.bridge.notifyCharacterChatChange(partnerId, null);
    this.idleRoamBusy.delete(characterId);
    this.idleRoamBusy.delete(partnerId);
  }

  private clearChatTalkTimer(characterId: number): void {
    const talk = this.chatTalkTimers.get(characterId);
    if (talk) {
      talk.remove(false);
      this.chatTalkTimers.delete(characterId);
    }
  }

  /**
   * Idle stile NPC Pokémon: spesso si gira sul posto, a volte un passo, a volte resta fermo.
   * Se un altro «in giro» è vicino, possono avvicinarsi e chiacchierare ~1 ora di gioco.
   */
  private runIdleRoamTick(characterId: number): void {
    if (getOrologioGiocoInPausaSnapshot()) {
      this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_PAUSE_MS);
      return;
    }
    const snapshot = this.bridge.getSnapshot();
    const character = snapshot.characters.find((c) => c.id === characterId);
    const view = this.characterViews.get(characterId);
    if (!character?.idleRoamAllowed || !view?.root?.active) return;
    if ((character.path?.length ?? 0) >= 2) return;
    if (this.idleRoamBusy.has(characterId) || this.chatPartnerById.has(characterId)) return;

    if (this.tryStartIdleChat(characterId, character, view, snapshot)) return;

    const roll = Math.random();
    if (roll < 0.55) {
      const dirs: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
      const others = dirs.filter((d) => d !== view.direction);
      view.direction = others[Math.floor(Math.random() * others.length)] ?? view.direction;
      this.setCharacterIdleFrame(view, character);
      this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_LOOK_MS);
      return;
    }
    if (roll < 0.8) {
      this.tryIdleStep(characterId, character, view, snapshot);
      return;
    }
    this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_PAUSE_MS);
  }

  private tryStartIdleChat(
    characterId: number,
    character: PhaserMapCharacter,
    view: CharacterView,
    snapshot: PhaserMapSnapshot
  ): boolean {
    // Non ogni tick: evita che si agganciano appena si vedono.
    if (Math.random() > 0.28) return false;
    // Non iniziare se già davanti a una porta: la chiacchiera non deve mai stare lì.
    if (this.isBuildingDoorEntryCell(view.logicalCell, snapshot)) return false;

    let bestId: number | null = null;
    let bestDist = Infinity;
    for (const other of snapshot.characters) {
      if (other.id === characterId) continue;
      if (!other.idleRoamAllowed || (other.path?.length ?? 0) >= 2) continue;
      if (this.idleRoamBusy.has(other.id) || this.chatPartnerById.has(other.id)) continue;
      if (this.isChatPairOnCooldown(characterId, other.id)) continue;
      const otherView = this.characterViews.get(other.id);
      if (!otherView?.root?.active) continue;
      if (this.isBuildingDoorEntryCell(otherView.logicalCell, snapshot)) continue;
      const dist = this.manhattanCells(view.logicalCell, otherView.logicalCell, snapshot.cols);
      if (dist < 1 || dist > KingdomMapScene.CHAT_DETECT_DIST) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestId = other.id;
      }
    }
    if (bestId == null) return false;

    const partner = snapshot.characters.find((c) => c.id === bestId);
    const partnerView = this.characterViews.get(bestId);
    if (!partner || !partnerView) return false;

    this.clearIdleRoamTimer(characterId);
    this.clearIdleRoamTimer(bestId);
    this.idleRoamBusy.add(characterId);
    this.idleRoamBusy.add(bestId);
    this.chatPartnerById.set(characterId, bestId);
    this.chatPartnerById.set(bestId, characterId);
    this.bridge.notifyCharacterChatChange(characterId, bestId);
    this.bridge.notifyCharacterChatChange(bestId, characterId);

    this.runChatApproach(characterId, character, view, bestId, partner, partnerView, snapshot);
    return true;
  }

  private runChatApproach(
    idA: number,
    charA: PhaserMapCharacter,
    viewA: CharacterView,
    idB: number,
    charB: PhaserMapCharacter,
    viewB: CharacterView,
    snapshot: PhaserMapSnapshot
  ): void {
    if (this.chatPartnerById.get(idA) !== idB) return;
    if (!this.isActiveCharacterView(viewA, idA) || !this.isActiveCharacterView(viewB, idB)) {
      this.abortChatFor(idA);
      return;
    }
    const stillA = this.bridge.getSnapshot().characters.find((c) => c.id === idA);
    const stillB = this.bridge.getSnapshot().characters.find((c) => c.id === idB);
    if (!stillA?.idleRoamAllowed || !stillB?.idleRoamAllowed) {
      this.abortChatFor(idA);
      return;
    }

    const dist = this.manhattanCells(viewA.logicalCell, viewB.logicalCell, snapshot.cols);
    if (dist <= 1) {
      if (this.chatWouldBlockDoorway(viewA.logicalCell, viewB.logicalCell, snapshot)) {
        this.abortChatFor(idA);
        this.ensureIdleRoamScheduled(idA);
        this.ensureIdleRoamScheduled(idB);
        return;
      }
      this.beginChatTalk(idA, charA, viewA, idB, charB, viewB, snapshot);
      return;
    }

    // Avvicina chi è più lontano dal partner (un passo); altrimenti l’altro.
    // Non calpestare le celle davanti alle porte: la chiacchiera non deve fermarsi lì.
    const movedA = this.stepTowardCell(
      idA,
      charA,
      viewA,
      viewB.logicalCell,
      snapshot,
      () => {
        this.runChatApproach(idA, charA, viewA, idB, charB, viewB, snapshot);
      },
      { avoidDoorEntry: true }
    );
    if (movedA) return;
    const movedB = this.stepTowardCell(
      idB,
      charB,
      viewB,
      viewA.logicalCell,
      snapshot,
      () => {
        this.runChatApproach(idA, charA, viewA, idB, charB, viewB, snapshot);
      },
      { avoidDoorEntry: true }
    );
    if (movedB) return;

    // Bloccati: chiacchierano se già adiacenti e fuori dalle porte, altrimenti annullano.
    if (dist <= 1 && !this.chatWouldBlockDoorway(viewA.logicalCell, viewB.logicalCell, snapshot)) {
      this.beginChatTalk(idA, charA, viewA, idB, charB, viewB, snapshot);
    } else {
      this.abortChatFor(idA);
      this.ensureIdleRoamScheduled(idA);
      this.ensureIdleRoamScheduled(idB);
    }
  }

  private beginChatTalk(
    idA: number,
    charA: PhaserMapCharacter,
    viewA: CharacterView,
    idB: number,
    charB: PhaserMapCharacter,
    viewB: CharacterView,
    snapshot: PhaserMapSnapshot
  ): void {
    if (this.chatPartnerById.get(idA) !== idB) return;
    if (this.chatWouldBlockDoorway(viewA.logicalCell, viewB.logicalCell, snapshot)) {
      this.abortChatFor(idA);
      this.ensureIdleRoamScheduled(idA);
      this.ensureIdleRoamScheduled(idB);
      return;
    }
    viewA.direction = this.directionForStep(viewA.logicalCell, viewB.logicalCell, snapshot.cols, viewA.direction);
    viewB.direction = this.directionForStep(viewB.logicalCell, viewA.logicalCell, snapshot.cols, viewB.direction);
    this.setCharacterIdleFrame(viewA, charA);
    this.setCharacterIdleFrame(viewB, charB);

    // Esito relazioni all’inizio della conversazione (non a fine ora): così non si perde se interrotta.
    this.bridge.notifyCharacterChatFinished(idA, idB);

    const anchorId = Math.min(idA, idB);
    this.clearChatTalkTimer(anchorId);
    // 1 ora di gioco = 60 min; a ×1 → 60s reali. Rispetta pausa e ×5/×10.
    let remainingGameMin = 60;
    const tickTalk = () => {
      if (this.chatPartnerById.get(idA) !== idB) return;
      if (getOrologioGiocoInPausaSnapshot()) {
        const wait = this.time.delayedCall(400, tickTalk);
        this.chatTalkTimers.set(anchorId, wait);
        return;
      }
      remainingGameMin -= 1;
      if (remainingGameMin <= 0) {
        this.chatTalkTimers.delete(anchorId);
        this.finishChatSeparate(idA, charA, viewA, idB, charB, viewB, this.bridge.getSnapshot());
        return;
      }
      const wait = this.time.delayedCall(
        scalaDurataRealeMs(1000, getOrologioGiocoVelocitaSnapshot()),
        tickTalk
      );
      this.chatTalkTimers.set(anchorId, wait);
    };
    tickTalk();
  }

  private finishChatSeparate(
    idA: number,
    charA: PhaserMapCharacter,
    viewA: CharacterView,
    idB: number,
    charB: PhaserMapCharacter,
    viewB: CharacterView,
    snapshot: PhaserMapSnapshot
  ): void {
    if (this.chatPartnerById.get(idA) !== idB) return;

    const cooldown = scalaDurataRealeMs(
      KingdomMapScene.CHAT_PAIR_COOLDOWN_MS,
      getOrologioGiocoVelocitaSnapshot()
    );
    this.chatPairCooldownUntil.set(this.chatPairKey(idA, idB), this.time.now + cooldown);

    this.chatPartnerById.delete(idA);
    this.chatPartnerById.delete(idB);
    this.bridge.notifyCharacterChatChange(idA, null);
    this.bridge.notifyCharacterChatChange(idB, null);

    let leftA = KingdomMapScene.CHAT_SEPARATE_STEPS;
    let leftB = KingdomMapScene.CHAT_SEPARATE_STEPS;

    const done = () => {
      this.idleRoamBusy.delete(idA);
      this.idleRoamBusy.delete(idB);
      this.ensureIdleRoamScheduled(idA);
      this.ensureIdleRoamScheduled(idB);
    };

    const stepAway = () => {
      if (!this.isActiveCharacterView(viewA, idA) || !this.isActiveCharacterView(viewB, idB)) {
        this.idleRoamBusy.delete(idA);
        this.idleRoamBusy.delete(idB);
        return;
      }
      const snap = this.bridge.getSnapshot();
      let progressed = false;
      if (leftA > 0) {
        const away = this.cellAwayFrom(viewA.logicalCell, viewB.logicalCell, snap.cols, snap.rows);
        if (
          away != null &&
          this.stepTowardCell(idA, charA, viewA, away, snap, () => {
            leftA -= 1;
            stepAway();
          })
        ) {
          progressed = true;
          return;
        }
        leftA = 0;
      }
      if (leftB > 0) {
        const away = this.cellAwayFrom(viewB.logicalCell, viewA.logicalCell, snap.cols, snap.rows);
        if (
          away != null &&
          this.stepTowardCell(idB, charB, viewB, away, snap, () => {
            leftB -= 1;
            stepAway();
          })
        ) {
          progressed = true;
          return;
        }
        leftB = 0;
      }
      if (!progressed) done();
    };

    stepAway();
  }

  /** Cella ortogonale che aumenta la distanza da `fromOther` (per allontanarsi). */
  private cellAwayFrom(from: number, fromOther: number, cols: number, rows: number): number | null {
    const neighbors = orthogonalNeighbors(from, cols, rows);
    let best: number | null = null;
    let bestDist = this.manhattanCells(from, fromOther, cols);
    for (const n of neighbors) {
      const d = this.manhattanCells(n, fromOther, cols);
      if (d > bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  /**
   * Un passo verso `goalCell` (o adiacente). Ritorna true se ha avviato l’animazione.
   * `onArrived` è chiamato a fine passo (anche se bloccato non viene chiamato — ritorna false).
   */
  private stepTowardCell(
    characterId: number,
    character: PhaserMapCharacter,
    view: CharacterView,
    goalCell: number,
    snapshot: PhaserMapSnapshot,
    onArrived: () => void,
    options?: { avoidDoorEntry?: boolean }
  ): boolean {
    const from = view.logicalCell;
    if (from === goalCell) {
      onArrived();
      return true;
    }
    const cand = orthogonalNeighbors(from, snapshot.cols, snapshot.rows);
    cand.sort(
      (a, b) =>
        this.manhattanCells(a, goalCell, snapshot.cols) - this.manhattanCells(b, goalCell, snapshot.cols)
    );
    for (const cell of cand) {
      if (this.manhattanCells(cell, goalCell, snapshot.cols) > this.manhattanCells(from, goalCell, snapshot.cols)) {
        continue;
      }
      if (options?.avoidDoorEntry && this.isBuildingDoorEntryCell(cell, snapshot)) continue;
      if (!this.bridge.attemptCharacterIdleStep(characterId, from, cell)) continue;
      this.animateIdleStepTo(characterId, character, view, cell, snapshot, onArrived);
      return true;
    }
    return false;
  }

  private animateIdleStepTo(
    characterId: number,
    character: PhaserMapCharacter,
    view: CharacterView,
    destination: number,
    snapshot: PhaserMapSnapshot,
    onComplete: () => void
  ): void {
    const from = view.logicalCell;
    const direction = this.directionForStep(from, destination, snapshot.cols, view.direction);
    const pos = this.characterPosition(destination, snapshot);
    const tween = this.tweens.add({
      targets: view.root,
      x: pos.x,
      y: pos.y,
      duration: KingdomMapScene.IDLE_STEP_MS,
      ease: "Linear",
      onUpdate: () => this.updateCharacterDepth(view.root),
      onStart: () => {
        if (!this.isActiveCharacterView(view, characterId)) {
          tween.stop();
          return;
        }
        const directionName = this.directionName(direction);
        if (view.usesLpc && character.characterAppearance) {
          const layers = resolveCharacterLayers(character.characterAppearance, "walk");
          view.sprites.forEach((layerSprite, layerIndex) => {
            if (!layerSprite?.active) return;
            const layer = layers[layerIndex];
            if (!layer || !this.textures.exists(layer.sourceId)) {
              layerSprite.setVisible(false);
              return;
            }
            layerSprite.setVisible(true).setTexture(layer.sourceId);
            this.playLpcLayerWalk(layerSprite, layer.sourceId, directionName);
          });
        } else if (view.sprite?.active) {
          view.sprite.play(`${view.sprite.texture.key}-walk-${directionName}`, true);
        }
        view.direction = direction;
      },
      onComplete: () => {
        if (!this.isActiveCharacterView(view, characterId)) return;
        view.logicalCell = destination;
        this.setCharacterIdleFrame(view, character);
        onComplete();
      }
    });
    void tween;
  }

  private tryIdleStep(
    characterId: number,
    character: PhaserMapCharacter,
    view: CharacterView,
    snapshot: PhaserMapSnapshot
  ): void {
    const from = view.logicalCell;
    const cand = orthogonalNeighbors(from, snapshot.cols, snapshot.rows);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cand[i]!;
      cand[i] = cand[j]!;
      cand[j] = tmp;
    }

    let to: number | null = null;
    for (const cell of cand) {
      if (this.bridge.attemptCharacterIdleStep(characterId, from, cell)) {
        to = cell;
        break;
      }
    }
    if (to == null) {
      if (Math.random() < 0.6) {
        const dirs: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
        const others = dirs.filter((d) => d !== view.direction);
        view.direction = others[Math.floor(Math.random() * others.length)] ?? view.direction;
        this.setCharacterIdleFrame(view, character);
      }
      this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_LOOK_MS);
      return;
    }

    this.idleRoamBusy.add(characterId);
    this.animateIdleStepTo(characterId, character, view, to, snapshot, () => {
      this.idleRoamBusy.delete(characterId);
      if (!this.isActiveCharacterView(view, characterId)) return;
      const still = this.bridge.getSnapshot().characters.find((c) => c.id === characterId);
      if (still?.idleRoamAllowed && (still.path?.length ?? 0) < 2) {
        this.scheduleIdleRoamAfter(characterId, KingdomMapScene.IDLE_ROAM_PAUSE_MS);
      }
    });
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
    this.setCharacterIdleFrame(view, character);
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

      if (building.underConstruction) {
        this.renderCantiereBuilding(base, overlay, width, height, snapshot.cellSize, building);
        this.renderBuildingDebug(building, snapshot);
        continue;
      }

      if (building.name === "Bosco") {
        this.renderBoscoBuilding(base, overlay, width, height, snapshot.cellSize);
        this.renderBuildingDebug(building, snapshot);
        continue;
      }

      if (building.name === "Ponte") {
        this.renderWoodenBridge(base, overlay, width, height, snapshot.cellSize);
        this.renderBuildingDebug(building, snapshot);
        continue;
      }

      if (building.artKey) {
        const image = this.add.image(width / 2, height, building.artKey).setOrigin(0.5, 1);
        const scale = Math.min((width * 1.12) / image.width, (height + snapshot.cellSize * 0.75) / image.height);
        image.setScale(scale);
        const shadow = this.add.ellipse(width / 2 + 2, height - 2, width * 0.82, snapshot.cellSize * 0.3, 0x000000, 0.25);
        // Nome edificio nascosto (rimosso dalla mappa)
        const overlayKey = `${building.artKey}-overlay`;
        const hasDedicatedOverlay = this.textures.exists(overlayKey);
        const overlayImage = this.add.image(width / 2, height, hasDedicatedOverlay ? overlayKey : building.artKey).setOrigin(0.5, 1).setScale(scale);
        if (!hasDedicatedOverlay) {
          const source = overlayImage.texture.getSourceImage();
          overlayImage.setCrop(0, 0, source.width, source.height * 0.62);
        }
        base.add([shadow, image]);
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

      this.renderUnifiedBuilding(base, overlay, width, height, snapshot.cellSize, building, col, colors);
      this.renderBuildingDebug(building, snapshot);
    }
    this.worldLayer.sort("depth");
  }

  /** Ponte basso in legno: assi leggibili, traverse e parapetti, senza coprire il fiume. */
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

    // Due travi scure tengono insieme le assi e fanno percepire subito il materiale.
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

  /** Facciata procedurale condivisa dagli edifici senza sprite dedicato. */
  private renderUnifiedBuilding(
    base: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Container,
    width: number,
    height: number,
    cellSize: number,
    building: PhaserMapBuilding,
    anchorCol: number,
    colors: (typeof BUILDING_COLORS)[keyof typeof BUILDING_COLORS]
  ): void {
    const pad = Math.max(3, Math.round(cellSize * 0.1));
    const roofH = Math.max(12, Math.round(height * 0.34));
    const wallTop = Math.max(8, Math.round(height * 0.24));
    const wallH = height - wallTop - pad;
    const facade = building.category === "residence" ? 0xd8bd91 : 0xb9aa8c;
    const facadeLight = building.category === "religion" ? 0xd8c9a9 : 0xc9b896;

    const shadow = this.add.ellipse(width / 2 + 3, height - 2, width * 0.88, Math.max(7, cellSize * 0.28), 0x10130e, 0.3);
    const wall = this.add.graphics();
    wall.fillStyle(0x2a2118, 1).fillRoundedRect(pad - 1, wallTop - 1, width - pad * 2 + 2, wallH + 2, 2);
    wall.fillStyle(facade, 1).fillRect(pad, wallTop, width - pad * 2, wallH);
    wall.fillStyle(facadeLight, 0.75).fillRect(pad + 2, wallTop + 2, width - pad * 2 - 4, 3);
    // Muratura discreta comune a tutte le categorie.
    wall.lineStyle(1, 0x746249, 0.32);
    for (let y = wallTop + 8, row = 0; y < height - pad; y += 7, row++) {
      wall.lineBetween(pad + 2, y, width - pad - 2, y);
      const offset = row % 2 === 0 ? 0 : 6;
      for (let x = pad + 8 + offset; x < width - pad; x += 12) wall.lineBetween(x, y - 6, x, y);
    }

    const doorX = (building.geometry.doorway.col - anchorCol + building.geometry.doorway.width / 2) * cellSize;
    const doorW = Math.max(8, Math.min(cellSize * 0.48, building.geometry.doorway.width * cellSize * 0.64));
    wall.fillStyle(0x3b2415, 1).fillRoundedRect(doorX - doorW / 2, height - pad - cellSize * 0.58, doorW, cellSize * 0.58, 2);
    wall.lineStyle(1, 0x1c120b, 1).strokeRoundedRect(doorX - doorW / 2, height - pad - cellSize * 0.58, doorW, cellSize * 0.58, 2);
    wall.fillStyle(0xd5a53f, 1).fillCircle(doorX + doorW * 0.28, height - pad - cellSize * 0.28, 1.5);

    const windowCount = Math.max(1, Math.min(4, building.widthCells));
    for (let i = 0; i < windowCount; i++) {
      const x = pad + ((width - pad * 2) * (i + 0.5)) / windowCount;
      if (Math.abs(x - doorX) < doorW) continue;
      wall.fillStyle(0x26333a, 1).fillRect(x - 5, wallTop + wallH * 0.38, 10, 9);
      wall.fillStyle(0x86b7b4, 1).fillRect(x - 3, wallTop + wallH * 0.38 + 2, 6, 5);
      wall.lineStyle(1, 0xd7c69f, 0.75).lineBetween(x, wallTop + wallH * 0.38 + 2, x, wallTop + wallH * 0.38 + 7);
    }
    base.add([shadow, wall]);

    const roof = this.add.graphics();
    roof.fillStyle(colors.border, 1).fillTriangle(pad - 3, wallTop + 2, width / 2, 1, width - pad + 3, wallTop + 2);
    roof.fillStyle(colors.roof, 1).fillTriangle(pad, wallTop, width / 2, 3, width - pad, wallTop);
    roof.lineStyle(1, colors.border, 0.45);
    for (let y = 8; y < roofH; y += 5) roof.lineBetween(pad + y * 0.45, y, width - pad - y * 0.45, y);
    roof.fillStyle(colors.fill, 1).fillRect(pad - 3, wallTop - 2, width - pad * 2 + 6, 4);

    const badgeSize = Math.max(14, Math.min(24, cellSize * 0.5));
    const badge = this.add.text(width / 2, wallTop + Math.min(wallH * 0.32, 16), building.emoji, {
      fontFamily: "Arial, sans-serif",
      fontSize: `${badgeSize}px`
    }).setOrigin(0.5).setShadow(0, 1, "#1c120b", 2);
    overlay.add([roof, badge]);
  }

  /** Cantiere: telo + emoji; barra di avanzamento SOPRA l’edificio. */
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
      .rectangle(width / 2, Math.max(6, height * 0.18), width - 2, Math.max(8, height * 0.28), 0xf59e0b, 0.9)
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

  /** Bosco: chioma irregolare, alberi, senza porta (ingresso da ogni lato). */
  private renderBoscoBuilding(
    base: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Container,
    width: number,
    height: number,
    cellSize: number
  ): void {
    const g = this.add.graphics();
    // Suolo bosco a rettangolo pieno (angoli dritti).
    g.fillStyle(0x14532d, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0x166534, 0.85);
    g.fillRect(0, height * 0.35, width * 0.55, height * 0.65);
    g.fillStyle(0x15803d, 0.8);
    g.fillRect(width * 0.5, height * 0.28, width * 0.5, height * 0.72);
    g.fillStyle(0x3f6212, 0.55);
    g.fillRect(0, height * 0.72, width, height * 0.28);

    type TreeSpec = { x: number; y: number; scale: number; crown: number; trunk: number };
    const crowns = [0x166534, 0x15803d, 0x14532d, 0x22c55e, 0x4d7c0f, 0x3f6212] as const;
    const trunks = [0x5c3a1e, 0x6b4423, 0x4a2f14] as const;
    const treeCount = Math.max(6, Math.round(width / (cellSize * 0.85)));
    const trees: TreeSpec[] = [];
    for (let i = 0; i < treeCount; i++) {
      const t = (i + 0.5) / treeCount;
      trees.push({
        x: 0.04 + t * 0.92,
        y: 0.45 + ((i * 17) % 5) * 0.08,
        scale: 0.75 + ((i * 11) % 5) * 0.08,
        crown: crowns[i % crowns.length]!,
        trunk: trunks[i % trunks.length]!
      });
    }

    for (const tree of trees) {
      const cx = width * tree.x;
      const baseY = height * tree.y;
      const trunkW = Math.max(3, cellSize * 0.14 * tree.scale);
      const trunkH = cellSize * 0.42 * tree.scale;
      const crownR = cellSize * 0.48 * tree.scale;

      g.fillStyle(tree.trunk, 1);
      g.fillRect(cx - trunkW / 2, baseY - trunkH, trunkW, trunkH);

      // Chiome a strati (conifere / latifoglie miste).
      g.fillStyle(tree.crown, 1);
      g.fillTriangle(
        cx,
        baseY - trunkH - crownR * 1.35,
        cx - crownR * 0.95,
        baseY - trunkH + crownR * 0.15,
        cx + crownR * 0.95,
        baseY - trunkH + crownR * 0.15
      );
      g.fillStyle(0x052e16, 0.35);
      g.fillTriangle(
        cx,
        baseY - trunkH - crownR * 0.85,
        cx - crownR * 0.7,
        baseY - trunkH + crownR * 0.05,
        cx + crownR * 0.55,
        baseY - trunkH + crownR * 0.05
      );
      g.fillStyle(0x86efac, 0.28);
      g.fillCircle(cx - crownR * 0.15, baseY - trunkH - crownR * 0.55, crownR * 0.22);
    }

    // Macchie di luce / sottobosco senza porta.
    g.fillStyle(0xa3e635, 0.22);
    g.fillEllipse(width * 0.18, height * 0.88, cellSize * 0.55, cellSize * 0.28);
    g.fillEllipse(width * 0.82, height * 0.86, cellSize * 0.48, cellSize * 0.24);
    g.fillStyle(0x365314, 0.4);
    g.fillEllipse(width * 0.5, height * 0.94, width * 0.7, cellSize * 0.32);

    base.add(g);

    // Overlay alto: chiome anteriori per profondità rispetto ai personaggi.
    const canopy = this.add.graphics();
    const frontTrees: TreeSpec[] = [];
    const frontCount = Math.max(3, Math.round(treeCount / 3));
    for (let i = 0; i < frontCount; i++) {
      const t = (i + 0.5) / frontCount;
      frontTrees.push({
        x: 0.08 + t * 0.84,
        y: 0.88 + ((i * 3) % 2) * 0.04,
        scale: 0.8 + ((i * 7) % 3) * 0.06,
        crown: crowns[(i + 2) % crowns.length]!,
        trunk: trunks[i % trunks.length]!
      });
    }
    for (const tree of frontTrees) {
      const cx = width * tree.x;
      const baseY = height * tree.y;
      const trunkW = Math.max(3, cellSize * 0.12 * tree.scale);
      const trunkH = cellSize * 0.36 * tree.scale;
      const crownR = cellSize * 0.42 * tree.scale;
      canopy.fillStyle(tree.trunk, 1);
      canopy.fillRect(cx - trunkW / 2, baseY - trunkH, trunkW, trunkH);
      canopy.fillStyle(tree.crown, 1);
      canopy.fillTriangle(
        cx,
        baseY - trunkH - crownR * 1.25,
        cx - crownR * 0.9,
        baseY - trunkH + crownR * 0.1,
        cx + crownR * 0.9,
        baseY - trunkH + crownR * 0.1
      );
    }
    overlay.add(canopy);
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
    if (this.locateArrow && this.locateCell != null) {
      this.syncLocateArrowPosition(this.bridge.getSnapshot().cellSize);
    }
    if (this.waterSprites.length === 0) return;
    // In pausa: acqua/fiume/mare fermi (come i personaggi).
    if (getOrologioSimTimeScaleSnapshot() <= 0) {
      this.nextWaterFrameAt = time + 420;
      return;
    }
    if (time < this.nextWaterFrameAt) return;
    this.nextWaterFrameAt = time + 420;
    this.waterFrame = (this.waterFrame + 1) % OVERWORLD_SHEET_PX.waterFrames;
    const key = frameKey(
      OVERWORLD_SHEET_PX.waterAnimX + this.waterFrame * OVERWORLD_SHEET_PX.tile,
      OVERWORLD_SHEET_PX.waterAnimY
    );
    for (const sprite of this.waterSprites) sprite.setFrame(key);
  }

  /**
   * Zoom minimo = “cover”: la mappa di gioco riempie sempre lo schermo.
   * Non si può zoomare indietro fino a vedere lo sfondo verde.
   * Zoom avanti ancora consentito; pan per muoversi.
   */
  private fitCameraToViewport(worldW: number, worldH: number, recenter: boolean): void {
    const camera = this.cameras.main;
    if (camera.width <= 0 || camera.height <= 0 || worldW <= 0 || worldH <= 0) return;
    this.updateCameraZoomLimits(worldW, worldH);
    // Zoom di riempimento (cover): niente sfondo visibile.
    camera.setZoom(this.minCameraZoom);
    if (recenter) camera.centerOn(worldW / 2, worldH / 2);
    this.hasFittedCamera = true;
  }

  private updateCameraZoomLimits(worldW: number, worldH: number): void {
    const camera = this.cameras.main;
    if (camera.width <= 0 || camera.height <= 0) return;
    // Mappa larga (~16:9): contain ≈ riempie lo schermo senza bande.
    const containZoom = Math.min(camera.width / worldW, camera.height / worldH);
    const coverZoom = Math.max(camera.width / worldW, camera.height / worldH);
    this.minCameraZoom = containZoom;
    this.maxCameraZoom = Math.max(coverZoom * 3, containZoom * 4, 3);
  }

  private configureCameraAndInput(): void {
    const camera = this.cameras.main;
    camera.setRoundPixels(true);
    const snapshot = this.bridge.getSnapshot();
    this.fitCameraToViewport(
      snapshot.cols * snapshot.cellSize,
      snapshot.rows * snapshot.cellSize,
      true
    );

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.dragPointerId = pointer.id;
      this.dragged = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) {
        this.emitHoveredCell(pointer);
        return;
      }
      if (pointer.id !== this.dragPointerId) return;
      const dx = pointer.x - pointer.prevPosition.x;
      const dy = pointer.y - pointer.prevPosition.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        if (!this.dragged) {
          this.dragged = true;
          this.bridge.setDragging(true);
        }
      }
      if (!this.dragged) return;
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
      const wasDragging = this.dragged;
      this.dragged = false;
      this.bridge.setDragging(false);
      if (wasDragging) return;

      const snap = this.bridge.getSnapshot();
      const world = camera.getWorldPoint(pointer.x, pointer.y);
      const col = Math.floor(world.x / snap.cellSize);
      const row = Math.floor(world.y / snap.cellSize);
      if (col < 0 || col >= snap.cols || row < 0 || row >= snap.rows) return;
      this.bridge.pressCell(row * snap.cols + col);
    });

    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const before = camera.getWorldPoint(pointer.x, pointer.y);
        const nextZoom = Phaser.Math.Clamp(
          camera.zoom * (dy > 0 ? 0.9 : 1.1),
          this.minCameraZoom,
          this.maxCameraZoom
        );
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
