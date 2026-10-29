/**
 * Developer-only RAF loop. A collapsed HUD must not compete with gameplay for
 * JS RAF callbacks or publish React diagnostic state every second.
 *
 * Lifecycle is explicit: focus+expanded => start, AppState foreground =>
 * resume, blur/collapse/unmount => stop. A generation token ignores a native
 * RAF callback delivered after cancelAnimationFrame().
 */
export class NativeHudFrameLoop {
  private active = false;
  private foreground = false;
  private requestId: number | null = null;
  private generation = 0;
  private delivered = 0;
  private requested = 0;

  constructor(
    private readonly request: (callback: (at: number) => void) => number,
    private readonly cancel: (id: number) => void,
    private readonly onFrame: (at: number) => void,
    private readonly onFault?: (error: unknown) => void
  ) {}

  start(foreground = true): void {
    if (this.active) return;
    this.active = true;
    this.foreground = foreground;
    ++this.generation;
    this.arm();
  }

  setForeground(foreground: boolean): void {
    if (!this.active || this.foreground === foreground) return;
    this.foreground = foreground;
    ++this.generation;
    this.cancelOutstanding();
    this.arm();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.foreground = false;
    ++this.generation;
    this.cancelOutstanding();
  }

  snapshot(): Readonly<{ active: boolean; foreground: boolean; scheduled: boolean; delivered: number; requested: number }> {
    return {
      active: this.active,
      foreground: this.foreground,
      scheduled: this.requestId !== null,
      delivered: this.delivered,
      requested: this.requested
    };
  }

  /**
   * Diagnostics are optional: a faulty RAF bridge or HUD callback must never
   * crash resident movement. Retire this generation and require an explicit
   * close/reopen before trying the HUD again (no background retry loop).
   */
  private fail(error: unknown): void {
    this.active = false;
    this.foreground = false;
    ++this.generation;
    this.requestId = null;
    try { this.onFault?.(error); }
    catch { /* A broken diagnostic fault handler must not escape into gameplay. */ }
  }

  private cancelOutstanding(): void {
    const id = this.requestId;
    this.requestId = null;
    if (id === null) return;
    try { this.cancel(id); }
    catch (error) {
      // The OS may still deliver this callback; the generation guard drops it.
      // Teardown/background must remain safe even when native cancel throws.
      if (this.active && this.foreground) this.fail(error);
    }
  }

  private arm(): void {
    if (!this.active || !this.foreground || this.requestId !== null) return;
    const version = this.generation;
    this.requested++;
    try {
      this.requestId = this.request(timestamp => {
        if (!this.active || !this.foreground || version !== this.generation) return;
        this.requestId = null;
        this.delivered++;
        try { this.onFrame(timestamp); }
        catch (error) { this.fail(error); return; }
        if (version === this.generation) this.arm();
      });
    } catch (error) {
      // A failed native RAF request cannot leave an active-but-unscheduled HUD.
      this.fail(error);
    }
  }
}
