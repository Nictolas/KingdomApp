/**
 * Pure state machine combining app visibility with the game's manual/phase
 * pause. The scheduler runs only if both conditions permit movement.
 */
export class NativeResidentActivityGate {
  private foreground: boolean;
  private gamePaused: boolean;
  private lastActive: boolean;

  constructor(
    foreground: boolean,
    gamePaused: boolean,
    private readonly apply: (active: boolean) => void
  ) {
    this.foreground = foreground;
    this.gamePaused = gamePaused;
    this.lastActive = foreground && !gamePaused;
    apply(this.lastActive);
  }

  setForeground(value: boolean): void {
    if (this.foreground === value) return;
    this.foreground = value;
    this.publish();
  }

  setGamePaused(value: boolean): void {
    if (this.gamePaused === value) return;
    this.gamePaused = value;
    this.publish();
  }

  get active(): boolean {
    return this.lastActive;
  }

  private publish(): void {
    const next = this.foreground && !this.gamePaused;
    if (next === this.lastActive) return;
    this.lastActive = next;
    this.apply(next);
  }
}
