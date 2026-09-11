import type { CharacterAppearance } from "../../character-system/types";
import type { BuildingGeometry } from "../../game/buildingGeometry";

export type PhaserMapTile = {
  index: number;
  frameX: number;
  frameY: number;
  animation?: "water";
  overlayFrameX?: number;
  overlayFrameY?: number;
};

export type PhaserMapBuilding = {
  anchor: number;
  widthCells: number;
  heightCells: number;
  name: string;
  emoji: string;
  category: "residence" | "industry" | "service" | "security" | "religion" | "special";
  artKey?: "command-center" | "dormitory" | "greenhouse" | "frontier-hut";
  geometry: BuildingGeometry;
  /** True se l’istanza globale è ancora «In costruzione». */
  underConstruction?: boolean;
  /** 0–100 avanzamento cantiere. */
  progressoCostruzione?: number;
};

export type PhaserMapCharacter = {
  id: number;
  name: string;
  cell: number;
  path?: readonly number[];
  pathToken?: number;
  markerEmoji?: string;
  appearance?: "human" | "golem";
  characterAppearance?: CharacterAppearance;
  /** Se true, può fare idle stile Pokémon (guarda intorno / un passo) quando non è in commute. */
  idleRoamAllowed?: boolean;
};

export type PhaserMapInteraction = {
  mode: "select" | "build" | "demolish";
  hoverCell: number | null;
  affectedCells: readonly number[];
  valid: boolean;
};

/** Freccia «Individua» sulla mappa (segue lo sprite se presente, altrimenti la cella). */
export type PhaserLocateMarker = {
  cell: number;
  abitanteId: number;
};

export type PhaserMapSnapshot = {
  cols: number;
  rows: number;
  cellSize: number;
  tiles: readonly PhaserMapTile[];
  buildings: readonly PhaserMapBuilding[];
  characters: readonly PhaserMapCharacter[];
  interaction?: PhaserMapInteraction;
  locateMarker?: PhaserLocateMarker | null;
  /** Abitante selezionato col puntatore (cerchio sotto i piedi). */
  selectedAbitanteId?: number | null;
  showGrid?: boolean;
  debugBuildings?: boolean;
  revision: number;
};

export type PhaserMapActions = {
  onCellPress: (cellIndex: number) => void;
  onCellHover?: (cellIndex: number | null) => void;
  onCharacterPress?: (characterId: number) => void;
  onCharacterDoublePress?: (characterId: number) => void;
  onCharacterPathComplete?: (characterId: number, pathToken: number) => void;
  onCharacterStepAttempt?: (characterId: number, fromCell: number, toCell: number) => boolean;
  onCharacterPathBlocked?: (characterId: number, fromCell: number, blockedCell: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
  /** Chiamato una volta quando i pezzi LPC degli abitanti iniziali sono pronti (niente placeholder). */
  onCharacterAssetsReady?: () => void;
  /**
   * Passo idle (roam Pokémon): walkable + non interni edifici + claim.
   * Aggiorna anche l’ultima cella nota.
   */
  onCharacterIdleStepAttempt?: (characterId: number, fromCell: number, toCell: number) => boolean;
  /** Chiacchiera tra due «in giro»: id partner o null a fine conversazione. */
  onCharacterChatChange?: (characterId: number, chattingWithId: number | null) => void;
  /** Fine conversazione riuscita: applicare esito relazioni amici/rivali. */
  onCharacterChatFinished?: (characterIdA: number, characterIdB: number) => void;
};

/** API imperativa esposta dalla scena Phaser (focus/refresh/camera). */
export type PhaserMapSceneControls = {
  refreshViewport: () => void;
  centerOnCell: (cellIndex: number, options?: { zoomIn?: boolean }) => void;
};

type Listener = () => void;

/**
 * Confine imperativo tra React (stato e regole) e Phaser (render e input).
 * Phaser non possiede mai dati salvabili: legge snapshot immutabili ed emette azioni.
 */
export class MapSceneBridge {
  private snapshot: PhaserMapSnapshot;
  private actions: PhaserMapActions;
  private sceneControls: PhaserMapSceneControls | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(snapshot: PhaserMapSnapshot, actions: PhaserMapActions) {
    this.snapshot = snapshot;
    this.actions = actions;
  }

  getSnapshot = (): PhaserMapSnapshot => this.snapshot;

  setSnapshot(next: PhaserMapSnapshot): void {
    if (next === this.snapshot) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  setActions(actions: PhaserMapActions): void {
    this.actions = actions;
  }

  registerSceneControls(controls: PhaserMapSceneControls | null): void {
    this.sceneControls = controls;
  }

  refreshViewport(): void {
    this.sceneControls?.refreshViewport();
  }

  centerOnCell(cellIndex: number, options?: { zoomIn?: boolean }): void {
    this.sceneControls?.centerOnCell(cellIndex, options);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  pressCell(cellIndex: number): void {
    this.actions.onCellPress(cellIndex);
  }

  hoverCell(cellIndex: number | null): void {
    this.actions.onCellHover?.(cellIndex);
  }

  pressCharacter(characterId: number, doublePress: boolean): void {
    if (doublePress) this.actions.onCharacterDoublePress?.(characterId);
    else this.actions.onCharacterPress?.(characterId);
  }

  completeCharacterPath(characterId: number, pathToken: number): void {
    this.actions.onCharacterPathComplete?.(characterId, pathToken);
  }

  attemptCharacterStep(characterId: number, fromCell: number, toCell: number): boolean {
    return this.actions.onCharacterStepAttempt?.(characterId, fromCell, toCell) ?? true;
  }

  blockCharacterPath(characterId: number, fromCell: number, blockedCell: number): void {
    this.actions.onCharacterPathBlocked?.(characterId, fromCell, blockedCell);
  }

  setDragging(dragging: boolean): void {
    this.actions.onDragStateChange?.(dragging);
  }

  notifyCharacterAssetsReady(): void {
    this.actions.onCharacterAssetsReady?.();
  }

  attemptCharacterIdleStep(characterId: number, fromCell: number, toCell: number): boolean {
    return this.actions.onCharacterIdleStepAttempt?.(characterId, fromCell, toCell) ?? false;
  }

  notifyCharacterChatChange(characterId: number, chattingWithId: number | null): void {
    this.actions.onCharacterChatChange?.(characterId, chattingWithId);
  }

  notifyCharacterChatFinished(characterIdA: number, characterIdB: number): void {
    this.actions.onCharacterChatFinished?.(characterIdA, characterIdB);
  }
}
