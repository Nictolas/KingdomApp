import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina Regole Soddisfazione e il collegamento dalla pagina principale", () => {
  const pagina = readFileSync("app/soddisfazione.tsx", "utf8");
  const regole = readFileSync("app/regole-soddisfazione.tsx", "utf8");

  assert.match(pagina, /router\.push\("\/regole-soddisfazione"\)/);
  assert.match(regole, /Prelievo forzoso/);
  assert.match(regole, /Lutto familiare/);
  assert.match(regole, /Attivo/);
  assert.match(regole, /Proposto/);
});
