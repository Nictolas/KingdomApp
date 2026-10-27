/**
 * Synthetic VIEW load only. These are NOT gameplay inhabitants or save data.
 * Positions are distributed over the full test viewport for fair comparison.
 */
export const NATIVE_TEST_POPULATIONS = [25, 50, 100, 200] as const;
export type NativeTestPopulation = (typeof NATIVE_TEST_POPULATIONS)[number];

export type NativeSyntheticMarker = {
  id: number;
  col: number;
  row: number;
  direction: -1 | 1;
};

export function createNativeSyntheticMarkers(count: NativeTestPopulation): NativeSyntheticMarker[] {
  if (!NATIVE_TEST_POPULATIONS.includes(count)) {
    throw new Error("Unsupported native test population");
  }
  return Array.from({ length: count }, (_, slot) => {
    const index = Math.floor(slot * 200 / count);
    return {
      id: index + 10000,
      col: index % 20,
      row: Math.floor(index / 20),
      direction: index % 2 === 0 ? 1 as const : -1 as const
    };
  });
}
