/**
 * Stable, small environment metadata for an opt-in native JS capture.
 * No device identifiers, resident IDs, paths, coordinates or touch payloads.
 */
export type NativeCaptureContext = Readonly<{
  platform: string;
  label: string;
  residents: number;
  terrainCells?: number;
  /** 0 means the simulation is paused/blocked, otherwise 1/2/4. */
  timeScale: number;
}>;

/**
 * A mid-capture scene/speed change makes before/after frame samples
 * incomparable. Reject rather than silently labeling a mixed capture as the
 * population and speed selected at its beginning.
 *
 * Pure and allocation-free on the valid hot path.
 */
export function nativeCaptureContextChanged(
  started: NativeCaptureContext,
  current: NativeCaptureContext
): boolean {
  return started.platform !== current.platform ||
    started.label !== current.label ||
    started.residents !== current.residents ||
    started.terrainCells !== current.terrainCells ||
    started.timeScale !== current.timeScale ||
    !Number.isFinite(current.timeScale) ||
    !Number.isSafeInteger(current.residents) ||
    current.residents < 0 ||
    (current.terrainCells !== undefined &&
      (!Number.isSafeInteger(current.terrainCells) || current.terrainCells < 0));
}
