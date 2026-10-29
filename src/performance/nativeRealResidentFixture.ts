/**
 * Completely ephemeral development fixture for the ACTUAL native resident
 * renderer. Uses 20×20 cells instead of modifying GameContext citizens.
 *
 * The fixture owns its own occupancy maps; no save data, IDs, paths, or
 * statistics from a player's kingdom are read or written.
 */
export const NATIVE_REAL_FIXTURE_COLS = 20;
export const NATIVE_REAL_FIXTURE_ROWS = 20;
export const NATIVE_REAL_FIXTURE_CELLS = NATIVE_REAL_FIXTURE_COLS * NATIVE_REAL_FIXTURE_ROWS;

export type NativeRealFixtureResident = Readonly<{
  instanceId: number;
  spawnCell: number;
}>;

export function createNativeRealFixtureResidents(count: 25 | 50 | 100 | 200): NativeRealFixtureResident[] {
  if (![25, 50, 100, 200].includes(count)) throw new Error("Unsupported native fixture population");
  return Array.from({ length: count }, (_, index) => ({
    // Never collide with normal in-game IDs; these IDs exist only in memory.
    instanceId: 10000 + index,
    spawnCell: Math.floor(index * NATIVE_REAL_FIXTURE_CELLS / count)
  }));
}

/**
 * Optional A/B commute workload: every resident owns a distinct horizontal
 * two-cell lane (spawn and spawn+1). Alternating legs exercise the actual
 * native commute runner without Math.random or contention-dependent routes.
 * This is NOT a substitute for the random-walk/collision workload.
 */
export function createNativeRealFixtureCommutePath(
  resident: NativeRealFixtureResident, returning = false
): number[] {
  const spawn = resident.spawnCell;
  if (!Number.isInteger(spawn) || spawn < 0 || spawn + 1 >= NATIVE_REAL_FIXTURE_CELLS ||
      spawn % NATIVE_REAL_FIXTURE_COLS === NATIVE_REAL_FIXTURE_COLS - 1) {
    throw new Error("Invalid native fixture commute lane");
  }
  return returning ? [spawn + 1, spawn] : [spawn, spawn + 1];
}

/**
 * Same occupancy semantics as the real map's two Maps, with an explicit bound
 * on the fixture's cells and stable per-instance methods.
 *
 * A successful claim atomically frees the resident's previous cell. Failure
 * never changes either Map. Releasing an unowned cell cannot evict a different
 * resident; a duplicate release is a no-op.
 */
export class NativeRealFixtureOccupancy {
  private readonly occupantByCell = new Map<number, number>();
  private readonly cellByResident = new Map<number, number>();
  private denied = 0;
  private claims = 0;
  private releases = 0;
  private settled = 0;
  /** Readiness is initial fixture occupancy, not FPS or rendering proof. */
  private ready = false;
  /** First real commute completion per resident; not a synthetic tick. */
  private commuteReady = false;
  private readonly completedCommutes = new Set<number>();
  private readonly readinessListeners = new Set<() => void>();

  constructor(private readonly expectedResidents = 0) {
    if (!Number.isSafeInteger(expectedResidents) || expectedResidents < 0 ||
        expectedResidents > NATIVE_REAL_FIXTURE_CELLS) {
      throw new Error("Invalid native fixture expected population");
    }
  }

  readonly getReadySnapshot = (): boolean => this.ready;
  readonly getCommuteReadySnapshot = (): boolean => this.commuteReady;
  getCaptureReadySnapshot(requireCompletedCommute: boolean): boolean {
    return this.ready && (!requireCompletedCommute || this.commuteReady);
  }
  readonly subscribeReady = (listener: () => void): (() => void) => {
    this.readinessListeners.add(listener);
    return () => { this.readinessListeners.delete(listener); };
  };

  private refreshReadiness(): void {
    if (this.expectedResidents === 0) return;
    const ready = this.occupantByCell.size === this.expectedResidents;
    const commuteReady = ready && this.completedCommutes.size === this.expectedResidents;
    if (ready === this.ready && commuteReady === this.commuteReady) return;
    this.ready = ready;
    this.commuteReady = commuteReady;
    // At most two positive transitions for a fresh fixture: occupancy ready
    // and all first commute legs completed. No per-leg HUD render storm.
    for (const listener of this.readinessListeners) listener();
  }

  isFreeFor(residentId: number, cell: number): boolean {
    if (!Number.isInteger(cell) || cell < 0 || cell >= NATIVE_REAL_FIXTURE_CELLS) return false;
    const occupant = this.occupantByCell.get(cell);
    return occupant === undefined || occupant === residentId;
  }

  tryClaim(residentId: number, cell: number): boolean {
    if (!this.isFreeFor(residentId, cell)) {
      this.denied++;
      return false;
    }
    const occupiedBefore = this.occupantByCell.size;
    const previous = this.cellByResident.get(residentId);
    if (previous !== undefined && previous !== cell &&
      this.occupantByCell.get(previous) === residentId) {
      this.occupantByCell.delete(previous);
    }
    this.occupantByCell.set(cell, residentId);
    this.cellByResident.set(residentId, cell);
    this.claims++;
    // A walking transfer preserves occupancy; no notification per frame.
    if (this.occupantByCell.size !== occupiedBefore) this.refreshReadiness();
    return true;
  }

  /** A completed real commute leg, not initial spawn/settledAt. */
  markCommuteCompleted(residentId: number): void {
    if (!this.cellByResident.has(residentId) || this.completedCommutes.has(residentId)) return;
    this.completedCommutes.add(residentId);
    this.refreshReadiness();
  }

  release(residentId: number): void {
    const previous = this.cellByResident.get(residentId);
    if (previous === undefined) return;
    if (this.occupantByCell.get(previous) === residentId) {
      this.occupantByCell.delete(previous);
    }
    this.cellByResident.delete(residentId);
    // Reclaim after an interrupted/unmounted resident must prove movement
    // again, rather than reusing a stale completion from an old route.
    this.completedCommutes.delete(residentId);
    this.releases++;
    this.refreshReadiness();
  }

  settledAt(_residentId: number, _cell: number): void {
    this.settled++;
  }

  snapshot(): Readonly<{ occupied: number; claims: number; denied: number; releases: number; settled: number }> {
    return {
      occupied: this.occupantByCell.size,
      claims: this.claims,
      denied: this.denied,
      releases: this.releases,
      settled: this.settled
    };
  }

  /** Internal regression tests only: never called by the production map. */
  checkInvariants(): boolean {
    if (this.occupantByCell.size !== this.cellByResident.size) return false;
    for (const [cell, owner] of this.occupantByCell) {
      if (this.cellByResident.get(owner) !== cell) return false;
    }
    for (const [owner, cell] of this.cellByResident) {
      if (this.occupantByCell.get(cell) !== owner) return false;
    }
    return true;
  }
}

/**
 * Touch feedback is a separate external store. A tap must never cause the
 * parent 200-sprite workload to render again: only the tiny status overlay
 * subscribes. Methods are stable for useSyncExternalStore.
 */
export class NativeRealFixtureSelection {
  private selected: number | null = null;
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): number | null => this.selected;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly select = (residentId: number): void => {
    if (this.selected === residentId) return;
    this.selected = residentId;
    for (const listener of this.listeners) listener();
  };
}

/** Identical A/B eligibility. Occupancy readiness does not certify GPU/UI readiness. */
export function getNativeRealFixtureCaptureBlockReason(input: Readonly<{
  realRenderer: boolean; width: number; height: number; ready: boolean;
  settled: boolean; moving: boolean; timeScale: number;
}>): string | null {
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) ||
      input.width <= 0 || input.height <= 0) return "Attendi la geometria della scena.";
  if (!input.realRenderer) return null;
  if (!input.ready) return "Attendi che tutti gli sprite prenotino una cella.";
  if (!input.settled) return "Attendi 2 secondi di stabilizzazione della scena.";
  if (input.moving && (!Number.isFinite(input.timeScale) || input.timeScale <= 0))
    return "Riprendi il tempo di gioco prima di misurare sprite in movimento.";
  return null;
}
