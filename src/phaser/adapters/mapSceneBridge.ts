export type PhaserMapTile = {
  index: number;
  frameX: number;
  frameY: number;
  animation?: "water";
  overlayFrameX?: number;
  overlayFrameY?: number;
};

export type PhaserMapSnapshot = {
  cols: number;
  rows: number;
  cellSize: number;
  tiles: readonly PhaserMapTile[];
  revision: number;
};

export type PhaserMapActions = {
  onCellPress: (cellIndex: number) => void;
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

  setDragging(dragging: boolean): void {
    this.actions.onDragStateChange?.(dragging);
  }
}
