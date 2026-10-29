/**
 * Pure state machine combining app visibility with the game's manual/phase
 * pause. The scheduler runs only if both conditions permit movement.
 */
export class NativeResidentActivityGate {
  private foreground: boolean;
  private gamePaused: boolean;
  private lastActive: boolean;
  /** Retry only after a failed scheduler transition; no extra work normally. */
  private needsReconcile = false;
  private transitionEpoch = 0;

  constructor(
    foreground: boolean,
    gamePaused: boolean,
    private readonly apply: (active: boolean) => void
  ) {
    this.foreground = foreground;
    this.gamePaused = gamePaused;
    this.lastActive = foreground && !gamePaused;
    this.publishActive(this.lastActive);
  }

  setForeground(value: boolean): void {
    if (this.foreground === value) {
      if (this.needsReconcile) this.publishActive(this.lastActive);
      return;
    }
    this.foreground = value;
    this.publish();
  }

  setGamePaused(value: boolean): void {
    if (this.gamePaused === value) {
      if (this.needsReconcile) this.publishActive(this.lastActive);
      return;
    }
    this.gamePaused = value;
    this.publish();
  }

  get active(): boolean {
    return this.lastActive;
  }

  private publish(): void {
    const next = this.foreground && !this.gamePaused;
    if (next === this.lastActive && !this.needsReconcile) return;
    this.lastActive = next;
    this.publishActive(next);
  }

  private publishActive(active: boolean): void {
    const epoch = ++this.transitionEpoch;
    this.needsReconcile = true;
    try {
      this.apply(active);
      // A listener can synchronously publish a newer transition. Never let
      // an older publication clear a newer failed reconciliation.
      if (epoch === this.transitionEpoch) this.needsReconcile = false;
    } catch (error) {
      // Keep failed state retryable on duplicate AppState/clock events.
      // Preserve falsy thrown values and the newly requested gate state.
      throw error;
    }
  }
}
