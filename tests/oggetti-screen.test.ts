import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("Oggetti è di nuovo disponibile dal menu", () => {
  assert.equal(existsSync("app/oggetti.tsx"), true);

  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");
  assert.match(menu, /router\.push\("\/oggetti"\)/);
  assert.match(menu, />Oggetti<\/Text>/);

  const screen = readFileSync("app/oggetti.tsx", "utf8");
  assert.match(screen, /OGGETTI_INVENTARIO/);
  assert.doesNotMatch(screen, /OGGETTI_CATALOGO/);
});
