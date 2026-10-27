import type { PhaserMapCharacter } from "./mapSceneBridge";

export const PHASER_BENCHMARK_RESIDENT_COUNT = 200;
export const PHASER_BENCHMARK_SWEEP_COUNTS = [0, 50, 100, 200] as const;

/** Solo modalita diagnostiche esplicite. Nessun parametro altera una partita. */
export function parsePhaserBenchmarkResidentCount(query: string): number | null {
  const params = new URLSearchParams(query);
  if (params.get("perf") !== "1") return null;
  const raw = params.get("residents");
  return PHASER_BENCHMARK_SWEEP_COUNTS.find((count) => String(count) === raw) ?? null;
}

export const PHASER_BENCHMARK_MAP_COLS = 50;
export const PHASER_BENCHMARK_MAP_ROWS = 50;

/**
 * Fixture di stress del renderer: 200 sprite Phaser con tween effettivi.
 * NON genera abitanti del GameContext e NON testa IA, bisogni o lavoro.
 * Gli ID non vengono salvati nello stato della partita.
 */
export function createPhaserResidentsBenchmarkFixture(count: number): PhaserMapCharacter[] {
  if (!PHASER_BENCHMARK_SWEEP_COUNTS.some((n) => n === count)) {
    throw new Error("Unsupported benchmark sprite count");
  }
  return Array.from({ length: count }, (_, slot) => {
    // Campionamento uniforme delle posizioni, per non ammassare tutti
    // gli sprite nelle prime righe quando si provano 50 o 100 abitanti.
    const index = Math.floor((slot * PHASER_BENCHMARK_RESIDENT_COUNT) / count);
    const col = 4 + (index % 20) * 2;
    const row = 4 + Math.floor(index / 20) * 4;
    const start = row * PHASER_BENCHMARK_MAP_COLS + col;
    const path = [start];
    // ~50 s di movimento continuo, per coprire warmup e campionamento
    // dei tre scenari benchmark eseguiti in pagine distinte.
    for (let step = 0; step < 40; step += 1) {
      path.push(start + 1, start + 2, start + 1, start);
    }
    return {
      id: 10_000 + index,
      name: `Renderer stress ${index + 1}`,
      cell: start,
      path,
      pathToken: 1,
      appearance: "golem"
    };
  });
}

/** Mantiene immutata la fixture di riferimento e i relativi test. */
export function createPhaser200ResidentsBenchmarkFixture(): PhaserMapCharacter[] {
  return createPhaserResidentsBenchmarkFixture(PHASER_BENCHMARK_RESIDENT_COUNT);
}
