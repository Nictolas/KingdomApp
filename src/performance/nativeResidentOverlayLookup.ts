/**
 * Native-only resident-overlay lookup for the real kingdom map.
 *
 * Parent clock ticks can rerender the overlay with ~200 residents even when
 * neither names nor bar-arrival membership changed. Before this helper:
 *   - TWO Array.find scans for each rendered resident accessibility label;
 *   - Object.values(bars).some(ids => ids.includes(residentId)) per resident.
 *
 * Snapshot primitive values once per parent state identity change, then use
 * Map/Set O(1) lookups. No timers, RAFs, React state, GameContext, persistence,
 * selection changes or web-renderer changes are introduced.
 *
 * First matching resident name wins (matching Array.find semantics).
 * Set.has and Array.includes both use SameValueZero comparisons.
 */
export type NativeOverlayResidentIdentity = Readonly<{ id: number; nome?: string | null }>;
export type NativeOverlayBarArrivals = Readonly<Record<number, readonly number[]>>;

export class NativeResidentOverlayLookup {
  private readonly names = new Map<number, string>();
  private readonly atBar = new Set<number>();

  constructor(
    residents: readonly NativeOverlayResidentIdentity[],
    barArrivals: NativeOverlayBarArrivals
  ) {
    for (const resident of residents) {
      if (!this.names.has(resident.id)) {
        this.names.set(resident.id, resident.nome ?? `ID ${resident.id}`);
      }
    }
    for (const ids of Object.values(barArrivals)) {
      for (const id of ids) this.atBar.add(id);
    }
  }

  nameFor(id: number): string {
    return this.names.get(id) ?? `ID ${id}`;
  }

  hasBarArrival(id: number): boolean {
    return this.atBar.has(id);
  }

  /** Aggregate counts only; no resident IDs or personal information. */
  snapshot(): Readonly<{ residentNames: number; distinctBarArrivals: number }> {
    return {
      residentNames: this.names.size,
      distinctBarArrivals: this.atBar.size
    };
  }
}
