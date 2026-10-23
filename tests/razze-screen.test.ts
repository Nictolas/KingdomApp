import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { SCHEDE_RAZZE, schedaDaRazza } from "../src/game/razzeNavigazione.ts";

test("Razze è disponibile dal menu e tutte e sette le razze sono elencate", () => {
  assert.equal(existsSync("app/razze.tsx"), true);
  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");
  assert.match(menu, /router\.push\("\/razze"\)/);
  assert.match(menu, />Razze<\/Text>/);
  const screen = readFileSync("app/razze.tsx", "utf8");
  assert.match(screen, /SCHEDE_RAZZE\.map/);
  assert.equal(SCHEDE_RAZZE.length, 7);
  for (const razza of ["Umano", "Elfo", "Nano", "Orco", "Goblin", "Felix", "Golem"] as const) {
    assert.equal(schedaDaRazza(razza)?.razza, razza);
  }
});

test("Razze mantiene le anteprime LPC e il fallback Golem", () => {
  const screen = readFileSync("app/razze.tsx", "utf8");
  assert.match(screen, /generaAspettoDaSeed/);
  assert.match(screen, /CircularSpriteFrame/);
  assert.match(screen, /appearance=\{aspetto\.characterAppearance\}/);
  assert.match(screen, /item\.previewSeed != null/);
  assert.equal(SCHEDE_RAZZE.find(item => item.razza === "Golem")?.previewSeed, undefined);
  assert.ok(SCHEDE_RAZZE.filter(item => item.previewSeed != null).length === 6);
  assert.match(screen, /\{item\.emoji\}/);
});
