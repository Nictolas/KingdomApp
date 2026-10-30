/**
 * Pure Node model of the *native overlay render selection work*.
 * 200 residents × 500 parent clock renders, plus 20 immutable updates.
 * Not React reconciliation, JS bridge time, Android/iPhone FPS or GPU cost.
 */
import { NativeResidentOverlayLookup } from "../src/performance/nativeResidentOverlayLookup.ts";

const populations = [25, 50, 100, 200] as const;
type Identity = { id: number; nome: string };
const run = (
  population: (typeof populations)[number],
  cached: boolean
): { comparisons: number; checksum: number; elapsedNodeMs: number } => {
  let people: Identity[] = Array.from({ length: population }, (_, i) => ({
    id: i + 1, nome: "R " + i
  }));
  let bars: Record<number, number[]> = {
    10: people.filter(p => p.id % 3 === 0).map(p => p.id),
    11: people.filter(p => p.id % 7 === 0).map(p => p.id),
    12: people.filter(p => p.id % 11 === 0).map(p => p.id)
  };
  let lookup = new NativeResidentOverlayLookup(people, bars);
  let comparisons = 0;
  let checksum = 0;
  const start = performance.now();
  for (let tick = 0; tick < 500; tick++) {
    if (tick > 0 && tick % 25 === 0) {
      const id = tick % population + 1;
      people = people.map(person => person.id === id
        ? { ...person, nome: "Changed " + tick } : person);
      bars = { ...bars, 10: [...bars[10]!, id] };
      lookup = new NativeResidentOverlayLookup(people, bars);
    }
    for (const person of people) {
      let name: string;
      let atBar: boolean;
      if (cached) {
        name = lookup.nameFor(person.id);
        atBar = lookup.hasBarArrival(person.id);
      } else {
        // Mirrors the two name lookups for press/double-press labels.
        const firstName = people.find(p => p.id === person.id)?.nome ?? `ID ${person.id}`;
        name = people.find(p => p.id === person.id)?.nome ?? `ID ${person.id}`;
        if (name !== firstName) throw new Error("unstable name reference");
        atBar = Object.values(bars).some(ids => ids.includes(person.id));
      }
      // This is a deterministic outcome checksum, not an FPS measurement.
      checksum += name.length + (atBar ? 17 : 0);
      comparisons++;
    }
  }
  return { comparisons, checksum, elapsedNodeMs: Number((performance.now() - start).toFixed(3)) };
};

for (const population of populations) {
  const oldPath = run(population, false);
  const newPath = run(population, true);
  if (oldPath.checksum !== newPath.checksum ||
      oldPath.comparisons !== newPath.comparisons) {
    throw new Error("Native overlay benchmark semantic parity failed");
  }
  process.stdout.write(JSON.stringify({
    kind: "synthetic_native_overlay_lookup",
    population,
    parentRenders: 500,
    immutableStateUpdates: 19,
    selectionsPerPath: newPath.comparisons,
    baseline: oldPath,
    optimized: newPath,
    note: "Node lookup model only: not React commits, physical Android/iOS FPS, GPU or power measurements"
  }) + "\n");
}
