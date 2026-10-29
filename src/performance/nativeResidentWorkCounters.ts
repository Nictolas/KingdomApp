/**
 * Development-only aggregate counters for the existing native map's resident
 * requestAnimationFrame callbacks. No IDs, position, save data, storage or network.
 */
// Diagnostics are opt-in. When no focused, expanded native HUD owns a lease,
// the ~200 resident RAF callbacks do not update aggregate counters at all.
// A token prevents cleanup from an older HUD from disabling a newer one.
const samplingLeases = new Set<number>();
let nextSamplingLease = 1;
let samplingActive = false;

export function beginNativeResidentWorkSampling(): number {
  const token = nextSamplingLease++;
  samplingLeases.add(token);
  samplingActive = true;
  return token;
}

export function endNativeResidentWorkSampling(token: number): void {
  if (!samplingLeases.delete(token)) return;
  samplingActive = samplingLeases.size > 0;
  if (!samplingActive) {
    // Never carry per-second readings from an unfocused/closed HUD into
    // a later capture. Cumulative totals are preserved for snapshot deltas.
    callbacks = 0;
    renders = 0;
    wrapperRenders = 0;
    busCycles = 0;
  }
}

let callbacks = 0;

export function markNativeResidentFrameCallback(): void {
  if (!samplingActive) return;
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
  if (!samplingActive) return;
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
  if (!samplingActive) return;
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
  if (!samplingActive) return;
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
