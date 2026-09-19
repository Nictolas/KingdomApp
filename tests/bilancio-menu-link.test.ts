import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il menu principale espone di nuovo Bilancio", () => {
  const source = readFileSync("src/screens/GridGame.tsx", "utf8");
  assert.match(source, /router\.push\("\/crediti"\)/);
  assert.match(source, />Bilancio<\/Text>/);
});
