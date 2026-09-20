import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina Prelievo Forzoso come potere sempre disponibile del Re", () => {
  const pagina = readFileSync("app/prelievo-forzoso.tsx", "utf8");
  const leggi = readFileSync("app/leggi.tsx", "utf8");
  const catalogo = readFileSync("src/data/leggiData.ts", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const tasse = readFileSync("src/game/tasse.ts", "utf8");
  const types = readFileSync("src/types.ts", "utf8");

  assert.match(pagina, /stimaPrelievoForzoso/);
  assert.match(pagina, /eseguiPrelievoForzosoRe/);
  assert.match(leggi, /\/prelievo-forzoso/);
  assert.match(catalogo, /Prelievo Forzoso/);

  assert.match(hook, /eseguiPrelievoForzosoRe/);
  assert.match(context, /eseguiPrelievoForzosoRe/);
  assert.match(tasse, /export function eseguiPrelievoForzoso/);
  assert.match(tasse, /id: "prelievo_forzoso"/);
  assert.match(tasse, /delta: -3/);
  assert.match(types, /modificatoriSoddisfazione/);
});
