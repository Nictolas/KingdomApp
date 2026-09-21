import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il runtime usa Ex Sovrano e non Ex Governatore", () => {
  for (const path of [
    "src/types.ts",
    "src/game/generazionePartita.ts",
    "src/hooks/useGameState.ts",
    "src/data/fazioniData.ts",
    "app/regole-soddisfazione.tsx",
    "app/rivoluzionari.tsx"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /Ex Governatore|ex governatore/);
  }

  assert.match(readFileSync("src/types.ts", "utf8"), /"Ex Sovrano"/);
  assert.match(readFileSync("src/game/generazionePartita.ts", "utf8"), /exSovranoId/);
});
