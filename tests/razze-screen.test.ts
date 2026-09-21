import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("Razze è di nuovo disponibile dal menu", () => {
  assert.equal(existsSync("app/razze.tsx"), true);

  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");
  assert.match(menu, /router\.push\("\/razze"\)/);
  assert.match(menu, />Razze<\/Text>/);

  const screen = readFileSync("app/razze.tsx", "utf8");
  for (const razza of ["Umano", "Elfo", "Nano", "Orco", "Goblin", "Golem"]) {
    assert.match(screen, new RegExp(razza));
  }
});

test("Razze mostra di nuovo anteprime LPC per le razze renderizzabili", () => {
  const screen = readFileSync("app/razze.tsx", "utf8");

  assert.match(screen, /generaAspettoDaSeed/);
  assert.match(screen, /CircularSpriteFrame/);
  assert.match(screen, /appearance=\{aspetto\.characterAppearance\}/);
  assert.match(screen, /razza === "Golem" \? null/);
});
