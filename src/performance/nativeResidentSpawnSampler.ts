/**
 * Shared native-only initial spawn candidate buffer. The previous renderer
 * allocated one full-map number[] for every resident mount. The JS commit
 * effects run sequentially, so one Int32Array can be reused by ~200 residents.
 * Nested synchronous occupancy callbacks receive their own safe buffer.
 *
 * Preserves preferred/shared-home fallback, ascending candidate order,
 * deterministic instanceId offset and atomic claim attempts exactly.
 * Never caches occupancy or walkability between calls.
 */
export type NativeResidentSpawnRequest = Readonly<{
  totalCells: number;
  instanceId: number;
  preferredSpawnCell?: number | null;
  isWalkable: (cell: number) => boolean;
  isCellFreeForMe?: ((cell: number) => boolean) | null;
  tryClaimCell?: ((cell: number) => boolean) | null;
}>;

export class NativeResidentSpawnSampler {
  private sharedCandidates = new Int32Array(0);
  private sharedBufferAllocations = 0;
  private depth = 0;
  private nestedAllocations = 0;
  private selections = 0;

  pick({
    totalCells, instanceId, preferredSpawnCell = null, isWalkable,
    isCellFreeForMe, tryClaimCell
  }: NativeResidentSpawnRequest): number | null {
    const preferredValid = (cell: number): boolean =>
      cell >= 0 && cell < totalCells && isWalkable(cell) &&
      (isCellFreeForMe?.(cell) ?? true) &&
      (!tryClaimCell || tryClaimCell(cell));
    if (preferredSpawnCell != null && preferredValid(preferredSpawnCell)) {
      this.selections++;
      return preferredSpawnCell;
    }
    // Deliberately preserve the pre-existing shared-home behavior: the
    // preferred walkable cell can be chosen even if its claim is rejected.
    if (preferredSpawnCell != null && isWalkable(preferredSpawnCell)) {
      tryClaimCell?.(preferredSpawnCell);
      this.selections++;
      return preferredSpawnCell;
    }

    // Four bytes per cell at the largest map size seen by this module.
    // Only a map growth or synchronous reentrancy allocates another buffer.
    const outer = this.depth === 0;
    if (outer && this.sharedCandidates.length < totalCells) {
      this.sharedCandidates = new Int32Array(totalCells);
      this.sharedBufferAllocations++;
    }
    const candidates = outer ? this.sharedCandidates : new Int32Array(totalCells);
    if (!outer) this.nestedAllocations++;
    this.depth++;
    try {
      let count = 0;
      for (let cell = 0; cell < totalCells; cell++) {
        if (isWalkable(cell) && (isCellFreeForMe?.(cell) ?? true)) {
          candidates[count++] = cell;
        }
      }
      if (count === 0) {
        for (let cell = 0; cell < totalCells; cell++) {
          if (isWalkable(cell)) candidates[count++] = cell;
        }
      }
      if (count === 0) return null;
      const offsetIndex = (instanceId * 9973) % count;
      for (let offset = 0; offset < count; offset++) {
        const cell = candidates[(offsetIndex + offset) % count]!;
        if (!tryClaimCell || tryClaimCell(cell)) {
          this.selections++;
          return cell;
        }
      }
      return null;
    } finally {
      this.depth--;
    }
  }

  /** Aggregate in-memory counters; no cell, resident or saved-game data. */
  snapshot(): Readonly<{ selections: number; nestedAllocations: number; bufferCapacity: number; sharedBufferAllocations: number; depth: number }> {
    return {
      selections: this.selections,
      nestedAllocations: this.nestedAllocations,
      bufferCapacity: this.sharedCandidates.length,
      sharedBufferAllocations: this.sharedBufferAllocations,
      depth: this.depth
    };
  }
}

/** One buffer across mounted native residents; never imported on web. */
export const nativeResidentSpawnSampler = new NativeResidentSpawnSampler();
