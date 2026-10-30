import type { NativeResidentTimerCounters, NativeResidentTimerSnapshot } from "./nativeResidentTimerQueue";

type TimerCountersWithBuffer = NativeResidentTimerCounters & Partial<Pick<NativeResidentTimerSnapshot, "readyBufferUses">>;

export type NativeResidentTimerRate = Readonly<{
  platformWakeups: number;
  logicalCallbacks: number;
  platformSchedules: number;
  platformCancellations: number;
  budgetYields: number;
  timeBudgetYields: number;
  readyBufferUses: number;
  readyBufferUsesPerSecond: number;
  platformWakeupsPerSecond: number;
  logicalCallbacksPerSecond: number;
  budgetYieldsPerSecond: number;
  timeBudgetYieldsPerSecond: number;
}>;

/**
 * Aggregate counters for a bounded diagnostic interval, not a performance
 * claim. Counter reset or invalid duration cannot yield negative rates.
 */
export function diffNativeResidentTimerCounters(
  before: TimerCountersWithBuffer,
  after: TimerCountersWithBuffer,
  durationMs: number
): NativeResidentTimerRate {
  const delta = (field: keyof NativeResidentTimerCounters) =>
    Math.max(0, after[field] - before[field]);
  const platformWakeups = delta("platformWakeups");
  const logicalCallbacks = delta("logicalCallbacks");
  const seconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
  // Older fixture callers provide only the shared cumulative timer counters.
  // The optional buffer field is present on live native snapshots.
  const readyBufferUses = Number.isFinite(before.readyBufferUses) && Number.isFinite(after.readyBufferUses)
    ? Math.max(0, (after.readyBufferUses ?? 0) - (before.readyBufferUses ?? 0)) : 0;
  return {
    platformWakeups,
    logicalCallbacks,
    platformSchedules: delta("platformSchedules"),
    platformCancellations: delta("platformCancellations"),
    budgetYields: delta("budgetYields"),
    timeBudgetYields: delta("timeBudgetYields"),
    readyBufferUses,
    readyBufferUsesPerSecond: seconds > 0 ? readyBufferUses / seconds : 0,
    timeBudgetYieldsPerSecond: seconds > 0 ? delta("timeBudgetYields") / seconds : 0,
    budgetYieldsPerSecond: seconds > 0 ? delta("budgetYields") / seconds : 0,
    platformWakeupsPerSecond: seconds > 0 ? platformWakeups / seconds : 0,
    logicalCallbacksPerSecond: seconds > 0 ? logicalCallbacks / seconds : 0
  };
}
