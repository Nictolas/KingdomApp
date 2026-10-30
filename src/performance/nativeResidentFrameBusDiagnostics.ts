import type { NativeResidentFrameBusSnapshot } from "./nativeResidentFrameBus";

/**
 * Counts are JS scheduling activity, never GPU FPS or touch latency.
 * No identifiers, paths, personal information, storage or network.
 */
export type NativeResidentFrameBusRate = Readonly<{
  persistentRegistrations: number;
  oneShotRegistrations: number;
  platformFrameDispatches: number;
  oneShotBufferSwaps: number;
  /** Bridge faults observed within the capture window, not lost UI frames. */
  platformRequestFailures: number;
  platformCancelFailures: number;
  postDispatchRearmFailures: number;
  oneShotBufferSwapsPerSecond: number;
  persistentRegistrationsPerSecond: number;
  oneShotRegistrationsPerSecond: number;
  platformFrameDispatchesPerSecond: number;
  continuousSubscribersAtEnd: number;
  queuedAtEnd: number;
}>;

export function diffNativeResidentFrameBusSnapshots(
  before: NativeResidentFrameBusSnapshot,
  after: NativeResidentFrameBusSnapshot,
  durationMs: number
): NativeResidentFrameBusRate {
  const safeDelta = (field: "subscriptionAdds" | "oneShotRequests" | "dispatchCount" | "oneShotBufferSwaps" | "platformRequestFailures" | "platformCancelFailures" | "postDispatchRearmFailures") =>
    Math.max(0, after[field] - before[field]);
  const seconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
  const persistentRegistrations = safeDelta("subscriptionAdds");
  const oneShotRegistrations = safeDelta("oneShotRequests");
  const platformFrameDispatches = safeDelta("dispatchCount");
  const oneShotBufferSwaps = safeDelta("oneShotBufferSwaps");
  return {
    persistentRegistrations,
    oneShotRegistrations,
    platformFrameDispatches,
    oneShotBufferSwaps,
    platformRequestFailures: safeDelta("platformRequestFailures"),
    platformCancelFailures: safeDelta("platformCancelFailures"),
    postDispatchRearmFailures: safeDelta("postDispatchRearmFailures"),
    oneShotBufferSwapsPerSecond: seconds ? oneShotBufferSwaps / seconds : 0,
    persistentRegistrationsPerSecond: seconds ? persistentRegistrations / seconds : 0,
    oneShotRegistrationsPerSecond: seconds ? oneShotRegistrations / seconds : 0,
    platformFrameDispatchesPerSecond: seconds ? platformFrameDispatches / seconds : 0,
    continuousSubscribersAtEnd: after.continuousSubscribers,
    queuedAtEnd: after.queued
  };
}
