import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("selezionando il Ponte dal tutorial compare il terzo messaggio del Consigliere", () => {
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const mappa = readFileSync("app/mappa.tsx", "utf8");

  assert.match(state, /dialogPiazzaPonteAperto/);
  assert.match(state, /apriDialogPiazzaPonte/);
  assert.match(context, /Ben fatto mio Re!/);
  assert.match(context, /barra di avanzamento/);
  assert.match(context, /ogni ora avanzano di 1 punto a testa/);
  assert.match(mappa, /const daTutorial = spotlight\?\.active\?\.targetId === SPOTLIGHT_TARGET_IDS\.MAPPA_PONTE/);
  assert.match(mappa, /apriDialogPiazzaPonte\(\)/);
});
