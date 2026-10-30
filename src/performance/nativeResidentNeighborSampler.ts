/**
 * Native-only, allocation-stable free-roam neighbor picker.
 *
 * Exactly mirrors the former renderer algorithm: left/right/up/down order,
 * walkability and occupancy prefilter, Fisher-Yates shuffle, then sequential
 * atomic claims. No RNG draw when fewer than two candidates survive.
 *
 * A resident owns one four-cell Int32Array for its lifetime. In the unusual
 * case that a user-provided predicate/claim synchronously reenters pick(),
 * a temporary buffer protects the outer selection from corruption.
 * No game state, route, timer, save or web renderer is changed here.
 */
export class NativeResidentNeighborSampler {
  private readonly scratch = new Int32Array(4);
  private depth = 0;

  pick(
    from: number,
    cols: number,
    rows: number,
    isWalkable: (cell: number) => boolean,
    isFreeForMe?: ((cell: number) => boolean) | null,
    tryClaim?: ((cell: number) => boolean) | null,
    random: () => number = Math.random
  ): number | null {
    const buffer = this.depth === 0 ? this.scratch : new Int32Array(4);
    this.depth++;
    try {
      const col = from % cols;
      const row = Math.floor(from / cols);
      let count = 0;
      // Keep the original neighbor order to preserve seeded RNG behavior.
      if (col > 0) {
        const cell = from - 1;
        if (isWalkable(cell) && (isFreeForMe?.(cell) ?? true)) buffer[count++] = cell;
      }
      if (col < cols - 1) {
        const cell = from + 1;
        if (isWalkable(cell) && (isFreeForMe?.(cell) ?? true)) buffer[count++] = cell;
      }
      if (row > 0) {
        const cell = from - cols;
        if (isWalkable(cell) && (isFreeForMe?.(cell) ?? true)) buffer[count++] = cell;
      }
      if (row < rows - 1) {
        const cell = from + cols;
        if (isWalkable(cell) && (isFreeForMe?.(cell) ?? true)) buffer[count++] = cell;
      }
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = buffer[i]!;
        buffer[i] = buffer[j]!;
        buffer[j] = tmp;
      }
      for (let i = 0; i < count; i++) {
        const cell = buffer[i]!;
        if (!tryClaim || tryClaim(cell)) return cell;
      }
      return null;
    } finally {
      this.depth--;
    }
  }
}
