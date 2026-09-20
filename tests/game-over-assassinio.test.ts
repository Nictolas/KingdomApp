import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il GameProvider mostra il Game Over quando il Re ha salute zero", () => {
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const modal = readFileSync("src/ui/GameOverModal.tsx", "utf8");

  assert.match(context, /re\.salute <= 0/);
  assert.match(context, /setOrologioGiocoBloccatoDallaFase\(true\)/);
  assert.match(context, /<GameOverModal/);
  assert.match(context, /visible=\{gameOverPerMorteRe\}/);
  assert.match(context, /onRestart=\{nuovaPartita\}/);
  assert.match(context, /Il Re è stato assassinato/);

  assert.match(modal, /description\?: string/);
  assert.match(modal, /\{description\}/);
});
