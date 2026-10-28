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

export function markNativeResidentRenderInvocation(): void {
  renders += 1;
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

export function markNativeResidentWrapperInvocation(): void {
  wrapperRenders += 1;
}

export function takeNativeResidentWrapperInvocations(): number {
  const count = wrapperRenders;
  wrapperRenders = 0;
  return count;
}
