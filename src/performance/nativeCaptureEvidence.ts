import type { NativeResidentDispatchReport } from "./nativeResidentDispatchProfiler";
import type { NativeResidentEventLoopLag } from "./nativeResidentEventLoopProbe";

/**
 * A 10-second on-device A/B report requires both opt-in probes to have
 * completed. The JS loop heartbeat may be missing if its clock becomes
 * unusable or timers never execute; silently omitting lag would make the
 * resulting comparison look complete when it is not.
 *
 * A static scene may legitimately dispatch zero resident frames, so the
 * dispatch profile only needs to exist, not have a positive frame count.
 * No personal data, persistence, gameplay or platform-specific API.
 */
export function nativeCaptureHasRequiredProbes(
  dispatch: NativeResidentDispatchReport | null,
  lag: NativeResidentEventLoopLag | null
): boolean {
  return dispatch !== null && lag !== null &&
    lag.samples > 0 && Number.isSafeInteger(lag.samples) &&
    Number.isFinite(lag.p95Ms) && lag.p95Ms >= 0 &&
    Number.isFinite(lag.maxMs) && lag.maxMs >= lag.p95Ms;
}
