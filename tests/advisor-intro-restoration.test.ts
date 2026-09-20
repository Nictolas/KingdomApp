import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("l'introduzione del Consigliere torna solo in Avventura", () => {
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const modal = readFileSync("src/ui/ConsigliereIntroModal.tsx", "utf8");

  assert.match(state, /introConsigliereAperta/);
  assert.match(state, /if \(gameMode === "avventura"\)/);
  assert.match(state, /setIntroConsigliereAperta\(true\)/);
  assert.match(state, /const chiudiIntroConsigliere/);
  assert.match(context, /IntroConsigliereDialogWrapper/);
  assert.match(context, /Benvenuto Re/);
  assert.match(context, /lavoro === "Consigliere"/);
  assert.match(modal, /Il Consigliere/);
});
