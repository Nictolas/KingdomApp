import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina la pagina Soddisfazione collegata al motore e al menu", () => {
  const pagina = readFileSync("app/soddisfazione.tsx", "utf8");
  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");

  assert.match(pagina, /calcolaPunteggioSoddisfazione/);
  assert.match(pagina, /fasciaDaPunteggio/);
  assert.match(pagina, /Soddisfazione media/);
  assert.match(menu, /router\.push\("\/soddisfazione"\)/);
  assert.match(menu, />Soddisfazione</);
});
