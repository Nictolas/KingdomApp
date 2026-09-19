import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il catalogo Obiettivi è stato ripristinato", () => {
  const source = readFileSync("src/data/obiettiviCatalogo.ts", "utf8");

  assert.match(source, /export const OBIETTIVI_CATALOGO/);
  assert.match(source, /id: "primi_abitanti"/);
  assert.match(source, /id: "primo_edificio"/);
  assert.match(source, /id: "cento_abitanti"/);
  assert.match(source, /export function obiettiviSbloccati/);
});
