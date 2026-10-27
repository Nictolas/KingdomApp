import type { PhaserMapCharacter } from "./mapSceneBridge";

export const PHASER_BENCHMARK_RESIDENT_COUNT = 200;
export const PHASER_BENCHMARK_MAP_COLS = 50;
export const PHASER_BENCHMARK_MAP_ROWS = 50;

/**
 * Fixture di stress del renderer: 200 sprite Phaser con tween effettivi.
 * NON genera abitanti del GameContext e NON testa IA, bisogni o lavoro.
 * Gli ID non vengono salvati nello stato della partita.
 */
export function createPhaser200ResidentsBenchmarkFixture(): PhaserMapCharacter[] {
  return Array.from({ length: PHASER_BENCHMARK_RESIDENT_COUNT }, (_, index) => {
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
