import { NativeResidentActivityGate } from "./nativeResidentActivityGate";

/**
 * One lifecycle binding for the entire native resident population.
 * Pure dependencies make bootstrap, failed subscriptions and late native
 * notifications testable without React Native, clocks or per-resident work.
 */
export type NativeResidentLifecycleBindings = Readonly<{
  readForeground: () => boolean;
  readGamePaused: () => boolean;
  applyActive: (active: boolean) => void;
  subscribeForeground: (listener: (foreground: boolean) => void) => () => void;
  subscribeGamePaused: (listener: () => void) => () => void;
}>;

/**
 * Installation is atomic: a throwing initial scheduler update or a failed
 * listener registration must not leave a "ready" singleton without its
 * foreground/pause observers. A later ensure() can retry from a clean slate.
 *
 * No timers or RAF are created by this class; all residents share one gate.
 */
export class NativeResidentLifecycleBootstrap {
  private ready = false;
  private installing = false;
  private generation = 0;
  private gate: NativeResidentActivityGate | null = null;
  private unsubscribeForeground: (() => void) | null = null;
  private unsubscribeGamePaused: (() => void) | null = null;

  constructor(private readonly bindings: NativeResidentLifecycleBindings) {}

  ensure(): void {
    if (this.ready || this.installing) return;
    this.installing = true;
    const generation = ++this.generation;
    let unpause: (() => void) | null = null;
    let unforeground: (() => void) | null = null;
    try {
      // The gate applies the initial state once, before event subscriptions.
      // If applying throws, construction fails and ensure() remains retryable.
      const gate = new NativeResidentActivityGate(
        this.bindings.readForeground(),
        this.bindings.readGamePaused(),
        this.bindings.applyActive
      );
      this.gate = gate;
      // dispose() may be called synchronously by the initial bridge update.
      // Never install observers for an ownership generation already retired.
      if (generation !== this.generation) {
        throw new Error("Native resident lifecycle installation invalidated");
      }
      unpause = this.bindings.subscribeGamePaused(() => {
        if (generation !== this.generation) return;
        this.gate?.setGamePaused(this.bindings.readGamePaused());
      });
      unforeground = this.bindings.subscribeForeground(foreground => {
        if (generation !== this.generation) return;
        this.gate?.setForeground(foreground);
      });
      if (generation !== this.generation) {
        throw new Error("Native resident lifecycle installation invalidated");
      }
      // Close the initial-snapshot/subscription race: synchronously reconcile
      // any foreground/pause changes which occurred during registration.
      gate.setForeground(this.bindings.readForeground());
      gate.setGamePaused(this.bindings.readGamePaused());
      if (generation !== this.generation) {
        throw new Error("Native resident lifecycle installation invalidated");
      }
      this.unsubscribeGamePaused = unpause;
      this.unsubscribeForeground = unforeground;
      this.ready = true;
    } catch (error) {
      // An already delivered native callback may still arrive after removal.
      // Invalidate its generation before invoking external cleanup functions.
      this.generation++;
      this.gate = null;
      this.ready = false;
      try { unforeground?.(); } catch { /* preserve original error */ }
      try { unpause?.(); } catch { /* preserve original error */ }
      // Fail closed. If a partial initial resume happened, no walker may
      // continue without the lifecycle observers that would pause it.
      try { this.bindings.applyActive(false); } catch { /* preserve error */ }
      throw error;
    } finally {
      this.installing = false;
    }
  }

  /**
   * Fail-closed teardown: removing the observers must also suspend both
   * schedulers. Otherwise a live 200-resident RAF/timer population can keep
   * running after the only owner has stopped listening to background events.
   * This remains a deliberate dev/test teardown, not a per-resident operation.
   */
  dispose(): void {
    const hadOwnership = this.ready || this.installing || this.gate !== null ||
      this.unsubscribeForeground !== null || this.unsubscribeGamePaused !== null;
    this.generation++;
    this.ready = false;
    this.gate = null;
    const stopForeground = this.unsubscribeForeground;
    const stopPause = this.unsubscribeGamePaused;
    this.unsubscribeForeground = null;
    this.unsubscribeGamePaused = null;
    let firstError: unknown;
    let failed = false;
    try { stopForeground?.(); } catch (error) { firstError = error; failed = true; }
    try { stopPause?.(); } catch (error) {
      if (!failed) { firstError = error; failed = true; }
    }
    // Teardown must still suspend resident work even when removing a native
    // subscription throws. Preserve the first failure (including falsy throws).
    if (hadOwnership) {
      try { this.bindings.applyActive(false); }
      catch (error) {
        if (!failed) { firstError = error; failed = true; }
      }
    }
    if (failed) throw firstError;
  }

  get initialized(): boolean { return this.ready; }
}
