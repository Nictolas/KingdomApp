/**
 * Coordinated native resident scheduler gate (timers first, then RAF).
 *
 * A host timer/RAF bridge can throw while scheduling or cancelling work.
 * The two schedulers must still observe the same foreground/game-pause
 * transition; otherwise 200 walkers could resume while collision waits
 * remain paused, or vice versa.
 *
 * Pure dependency injection for integration tests. No game state, storage,
 * resident identifiers, new timer, or web renderer involvement.
 */
export function applyNativeResidentSchedulerActivity(
  active: boolean,
  setTimerActive: (active: boolean) => void,
  setFrameActive: (active: boolean) => void
): void {
  let firstError: unknown = undefined;
  let failed = false;
  try {
    setTimerActive(active);
  } catch (error) {
    firstError = error;
    failed = true;
  }
  try {
    setFrameActive(active);
  } catch (error) {
    if (!failed) {
      firstError = error;
      failed = true;
    }
  }
  // Even falsy thrown values are diagnostic failures.
  if (failed) throw firstError;
}
