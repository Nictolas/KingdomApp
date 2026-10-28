/**
 * Double-tap recognition for the native resident hit target only.
 *
 * The default/web MapWandererCharacter retains its original behavior.
 * A first tap still selects immediately when a single-tap handler exists;
 * only the second tap in the same uninterrupted eligibility window opens
 * the resident details.
 *
 * This class does not schedule a timeout or allocate per tap. It uses the
 * caller's monotonic performance.now() timestamp, never Date.now().
 */
export const NATIVE_RESIDENT_DOUBLE_TAP_MS = 400;

export type NativeResidentTapDecision = "single" | "double";

export class NativeResidentTapRecognizer {
  private lastTapAtMs: number | null = null;
  private eligibleForDoubleTap = false;

  /** Called after the native Pressable's committed eligibility changes. */
  setEligibleForDoubleTap(eligible: boolean): void {
    if (eligible === this.eligibleForDoubleTap) return;
    this.eligibleForDoubleTap = eligible;
    this.reset();
  }

  /** App/game pause, background and component unmount clear partial gestures. */
  reset(): void {
    this.lastTapAtMs = null;
  }

  /**
   * Return a decision, not a callback: the component invokes the latest
   * committed event relay, even after parent world-clock updates.
   */
  press(nowMs: number): NativeResidentTapDecision {
    if (!this.eligibleForDoubleTap || !Number.isFinite(nowMs)) {
      this.reset();
      return "single";
    }

    const previous = this.lastTapAtMs;
    if (previous !== null && nowMs >= previous &&
      nowMs - previous < NATIVE_RESIDENT_DOUBLE_TAP_MS) {
      this.reset(); // Third tap starts a new pair, never a triple tap.
      return "double";
    }

    // A non-monotonic or too-late sample starts a new pair.
    this.lastTapAtMs = nowMs;
    return "single";
  }
}
