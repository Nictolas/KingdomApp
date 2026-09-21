import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Culto del Sole usa capoReligiosoOmbre e non il vecchio stato Alieni", () => {
  const source = readFileSync("app/culto-sole.tsx", "utf8");

  assert.match(source, /capoReligiosoOmbre/);
  assert.doesNotMatch(source, /capoReligiosoAlieni/);
});
