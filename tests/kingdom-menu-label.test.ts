import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il menu principale usa Regno e non Colonia", () => {
  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");

  assert.match(menu, />🏰 Regno<\/Text>/);
  assert.doesNotMatch(menu, />🏘️ Colonia<\/Text>/);
});
