import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la legge famiglie usa matrimonioConGolem nel runtime", () => {
  for (const path of [
    "src/hooks/useGameState.ts",
    "src/context/GameContext.tsx",
    "src/game/avanzaMese.ts",
    "app/legge-famiglie.tsx"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /matrimonioConGolem/);
    assert.doesNotMatch(source, /matrimonioUmanoRobot/);
  }
});
