import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("le descrizioni delle fazioni usano lore medieval-fantasy del Regno", () => {
  const source = readFileSync("src/data/fazioniData.ts", "utf8");

  assert.doesNotMatch(source, /colonia|Madre Patria|pianeta/i);
  assert.match(source, /regno/i);
  assert.match(source, /ex governatore deposto/i);
});
