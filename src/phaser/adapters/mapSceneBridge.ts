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
  /** True se l'istanza globale e ancora in costruzione. */
  underConstruction?: boolean;
  /** Avanzamento cantiere 0-100. */
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
  /** Se true, può fare piccoli movimenti idle quando non sta seguendo un percorso. */
  idleRoamAllowed?: boolean;
};

export type PhaserMapInteraction = {
  mode: "select" | "build" | "demolish";
  hoverCell: number | null;
  affectedCells: readonly number[];
  valid: boolean;
};

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
  /** Freccia Individua: segue l'abitante o punta la cella nota. */
  locateMarker?: PhaserLocateMarker | null;
  /** Abitante selezionato col puntatore (cerchio sotto i piedi). */
  selectedAbitanteId?: number | null;
  showGrid?: boolean;
  /** Pausa globale della simulazione; il renderer mantiene la scena interattiva ma congela le animazioni legate al tempo. */
  paused?: boolean;
  revision: number;
};

export type PhaserDynamicSnapshotChanges = {
  characters: boolean;
  interaction: boolean;
  grid: boolean;
};

export function isPhaserSimulationPaused(snapshot: PhaserMapSnapshot): boolean {
  return snapshot.paused === true;
}

/**
 * Parti dinamiche che Phaser può aggiornare senza ricostruire terreno/edifici.
 *
 * Gli snapshot React mantengono riferimenti stabili tramite useMemo: un cambio hover
 * sostituisce solo `interaction`, mentre `characters` e `showGrid` restano invariati.
 * Usare questi riferimenti evita di riconciliare tutti i personaggi e ridisegnare la
 * griglia ad ogni spostamento del puntatore.
 */
export function getPhaserDynamicSnapshotChanges(
  previous: PhaserMapSnapshot,
  next: PhaserMapSnapshot
): PhaserDynamicSnapshotChanges {
  return {
    characters: previous.characters !== next.characters,
    interaction: previous.interaction !== next.interaction,
    grid: previous.showGrid !== next.showGrid
  };
}

export type PhaserMapActions = {
  onCellPress: (cellIndex: number) => void;
  onCellHover?: (cellIndex: number | null) => void;
  onCharacterPress?: (characterId: number) => void;
  onCharacterDoublePress?: (characterId: number) => void;
  onCharacterPathComplete?: (characterId: number, pathToken: number) => void;
  onCharacterStepAttempt?: (characterId: number, fromCell: number, toCell: number) => boolean;
  onCharacterPathBlocked?: (characterId: number, fromCell: number, blockedCell: number) => void;
  /** Valida un passo idle prima che Phaser sposti realmente l'abitante. */
  onCharacterIdleStepAttempt?: (characterId: number, fromCell: number, toCell: number) => boolean;
  /** Segnala l'inizio/fine di una chiacchierata tra abitanti. */
  onCharacterChatChange?: (characterId: number, chattingWithId: number | null) => void;
  /** Segnala che una chiacchierata tra due abitanti è terminata. */
  onCharacterChatFinished?: (characterIdA: number, characterIdB: number) => void;
  /** Chiamato quando gli asset LPC visibili sono pronti e non servono più placeholder. */
  onCharacterAssetsReady?: () => void;
  onDragStateChange?: (dragging: boolean) => void;
};

type Listener = () => void;

/**
 * Confine imperativo tra React (stato e regole) e Phaser (render e input).
 * Phaser non possiede mai dati salvabili: legge snapshot immutabili ed emette azioni.
 */
export class MapSceneBridge {
  private snapshot: PhaserMapSnapshot;
  private actions: PhaserMapActions;
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

  attemptCharacterIdleStep(characterId: number, fromCell: number, toCell: number): boolean {
    return this.actions.onCharacterIdleStepAttempt?.(characterId, fromCell, toCell) ?? false;
  }

  notifyCharacterChatChange(characterId: number, chattingWithId: number | null): void {
    this.actions.onCharacterChatChange?.(characterId, chattingWithId);
  }

  notifyCharacterChatFinished(characterIdA: number, characterIdB: number): void {
    this.actions.onCharacterChatFinished?.(characterIdA, characterIdB);
  }

  notifyCharacterAssetsReady(): void {
    this.actions.onCharacterAssetsReady?.();
  }

  setDragging(dragging: boolean): void {
    this.actions.onDragStateChange?.(dragging);
  }
}
