/**
 * Owns one opt-in sampling lease for a focused, expanded native HUD.
 * AppState "inactive" and "background" release it immediately, not merely
 * the diagnostic RAF. Idempotent for repeated OS lifecycle notifications.
 *
 * All counters remain in memory. No residents, coordinates or save data.
 */
export class NativeResidentSamplingLifecycle {
  private token: number | null = null;
  private disposed = false;

  constructor(
    private readonly begin: () => number,
    private readonly end: (token: number) => void
  ) {}

  setForeground(foreground: boolean): void {
    if (this.disposed) return;
    if (!foreground) {
      this.release();
    } else if (this.token === null) {
      this.token = this.begin();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }

  private release(): void {
    if (this.token === null) return;
    const token = this.token;
    this.token = null;
    this.end(token);
  }
}
