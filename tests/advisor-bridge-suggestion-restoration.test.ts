import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("dopo l'introduzione il Consigliere suggerisce il Ponte", () => {
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");

  assert.match(state, /suggerimentoPonteAperto/);
  assert.match(state, /setSuggerimentoPonteAperto\(true\)/);
  assert.match(state, /const chiudiSuggerimentoPonte/);
  assert.match(context, /Un fiume separa il nostro Regno/);
  assert.match(context, /gli Edili dell'Ufficio Edile/);
  assert.match(context, /visible=\{suggerimentoPonteAperto\}/);
});
