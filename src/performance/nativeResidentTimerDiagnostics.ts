import type { NativeResidentTimerCounters } from "./nativeResidentTimerQueue";

export type NativeResidentTimerRate = Readonly<{
  platformWakeups: number;
  logicalCallbacks: number;
  platformSchedules: number;
  platformCancellations: number;
  platformWakeupsPerSecond: number;
  logicalCallbacksPerSecond: number;
}>;

/**
 * Aggregate counters for a bounded diagnostic interval, not a performance
 * claim. Counter reset or invalid duration cannot yield negative rates.
 */
export function diffNativeResidentTimerCounters(
  before: NativeResidentTimerCounters,
  after: NativeResidentTimerCounters,
  durationMs: number
): NativeResidentTimerRate {
  const delta = (field: keyof NativeResidentTimerCounters) =>
    Math.max(0, after[field] - before[field]);
  const platformWakeups = delta("platformWakeups");
  const logicalCallbacks = delta("logicalCallbacks");
  const seconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
  return {
    platformWakeups,
    logicalCallbacks,
    platformSchedules: delta("platformSchedules"),
    platformCancellations: delta("platformCancellations"),
    platformWakeupsPerSecond: seconds > 0 ? platformWakeups / seconds : 0,
    logicalCallbacksPerSecond: seconds > 0 ? logicalCallbacks / seconds : 0
  };
}
