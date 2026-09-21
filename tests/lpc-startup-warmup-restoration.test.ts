import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("gli sprite LPC iniziali vengono precaricati prima della scelta partita", () => {
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const preload = readFileSync("src/character-system/preloadLpcAssets.ts", "utf8");
  const warm = readFileSync("src/game/warmStartupCharacters.ts", "utf8");

  assert.match(context, /warmStartupCharacterAssets/);
  assert.match(context, /gameSaveV1ToGameState\(result\.save\.payload\)\.abitanti/);
  assert.match(preload, /warmLpcSourceIds/);
  assert.match(preload, /Image\.prefetch/);
  assert.match(warm, /collectStartupLpcSourceIds/);
  assert.match(warm, /Consigliere/);
});
