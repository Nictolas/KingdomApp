import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina la pagina Tassa sul Patrimonio e il collegamento da Leggi", () => {
  const pagina = readFileSync("app/tassa-patrimonio.tsx", "utf8");
  const leggi = readFileSync("app/leggi.tsx", "utf8");

  assert.match(pagina, /GateTassaSbloccata/);
  assert.match(pagina, /tassaId="patrimonio"/);
  assert.match(pagina, /setTassaPatrimonioPercentuale/);
  assert.match(pagina, /stimaGettitoTasse/);
  assert.match(leggi, /Tassa sul Patrimonio/);
  assert.match(leggi, /\/tassa-patrimonio/);
});
