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
