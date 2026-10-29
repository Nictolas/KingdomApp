/**
 * Apply one pause/background transition to both native-only schedulers.
 *
 * The timer queue must be suspended before frame listeners can react, but a
 * failure in one platform adapter must never leave the other scheduler running.
 * Re-throw the first failure after attempting both transitions. This does not
 * mask an OS/bridge fault and does not touch gameplay state or persistence.
 */
export function applyNativeResidentSchedulersActive(
  active: boolean,
  setTimerActive: (active: boolean) => void,
  setFrameActive: (active: boolean) => void
): void {
  let failed = false;
  let firstError: unknown;
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
  if (failed) throw firstError;
}
