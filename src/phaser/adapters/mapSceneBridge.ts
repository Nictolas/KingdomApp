import type { CharacterAppearance } from "../../character-system/types";
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
};

export type PhaserMapInteraction = {
  mode: "select" | "build" | "demolish";
  hoverCell: number | null;
  affectedCells: readonly number[];
  valid: boolean;
};

export type PhaserMapSnapshot = {
  cols: number;
  rows: number;
  cellSize: number;
  tiles: readonly PhaserMapTile[];
  buildings: readonly PhaserMapBuilding[];
  characters: readonly PhaserMapCharacter[];
  interaction?: PhaserMapInteraction;
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

  setDragging(dragging: boolean): void {
    this.actions.onDragStateChange?.(dragging);
  }
}
