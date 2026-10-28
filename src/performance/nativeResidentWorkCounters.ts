/**
 * Development-only aggregate counters for the existing native map's resident
 * requestAnimationFrame callbacks. No IDs, position, save data, storage or network.
 */
let callbacks = 0;

export function markNativeResidentFrameCallback(): void {
  callbacks += 1;
}

export function takeNativeResidentFrameCallbacks(): number {
  const count = callbacks;
  callbacks = 0;
  return count;
}

/** Counts render function invocations, not React commits or FPS. */
let renders = 0;
let totalBodyInvocations = 0;

export function markNativeResidentRenderInvocation(): void {
  renders += 1;
  totalBodyInvocations += 1;
}

export function takeNativeResidentRenderInvocations(): number {
  const count = renders;
  renders = 0;
  return count;
}

/** One actual requestAnimationFrame dispatch shared by all active native residents. */
let busCycles = 0;

export function markNativeResidentBusCycle(): void {
  busCycles += 1;
}

export function takeNativeResidentBusCycles(): number {
  const count = busCycles;
  busCycles = 0;
  return count;
}

/**
 * Lightweight outer wrapper invocations (parent churn) versus expensive
 * memoized resident body invocations. Counts function calls, not commits.
 */
let wrapperRenders = 0;
let totalWrapperInvocations = 0;

export function markNativeResidentWrapperInvocation(): void {
  wrapperRenders += 1;
  totalWrapperInvocations += 1;
}

export function takeNativeResidentWrapperInvocations(): number {
  const count = wrapperRenders;
  wrapperRenders = 0;
  return count;
}

/** Cumulative, in-memory counters for user-initiated 10 s comparisons. */
export type NativeResidentRenderTotals = Readonly<{
  wrappers: number;
  bodies: number;
}>;

export function getNativeResidentRenderTotals(): NativeResidentRenderTotals {
  return { wrappers: totalWrapperInvocations, bodies: totalBodyInvocations };
}

export type NativeResidentRenderRate = NativeResidentRenderTotals & Readonly<{
  wrappersPerSecond: number;
  bodiesPerSecond: number;
}>;

export function diffNativeResidentRenderTotals(
  before: NativeResidentRenderTotals,
  after: NativeResidentRenderTotals,
  durationMs: number
): NativeResidentRenderRate {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Invalid resident render measurement duration");
  }
  const wrappers = Math.max(0, after.wrappers - before.wrappers);
  const bodies = Math.max(0, after.bodies - before.bodies);
  return {
    wrappers,
    bodies,
    wrappersPerSecond: wrappers * 1000 / durationMs,
    bodiesPerSecond: bodies * 1000 / durationMs
  };
}
