import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("Regni sostituisce definitivamente la vecchia terminologia Pianeti", () => {
  assert.equal(existsSync("app/regni.tsx"), true);
  assert.equal(existsSync("app/pianeti.tsx"), false);
  assert.equal(existsSync("src/data/regniData.ts"), true);
  assert.equal(existsSync("src/data/pianetiData.ts"), false);

  for (const path of [
    "src/data/regniData.ts",
    "src/data/index.ts",
    "src/kingdomData.ts",
    "app/regni.tsx",
    "app/mercato.tsx",
    "src/game/generazionePartita.ts",
    "src/hooks/useGameState.ts"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /pianetiData|PianetaInfo|\/pianeti|\bpianeta\b/i);
  }

  assert.match(readFileSync("app/mercato.tsx", "utf8"), /router\.push\("\/regni"\)/);
  assert.match(readFileSync("src/data/regniData.ts", "utf8"), /export const regniData/);
});
