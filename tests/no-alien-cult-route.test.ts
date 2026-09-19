import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("il vecchio Culto degli Alieni non è più una route canonica", () => {
  assert.equal(existsSync("app/culto-alieni.tsx"), false);

  const source = readFileSync("src/game/fedeleCulto.ts", "utf8");
  assert.doesNotMatch(source, /Culto degli Alieni/);
  assert.match(source, /Culto delle Ombre/);
});
