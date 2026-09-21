import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";

test("la vecchia rotta Spazioporto non esiste più", () => {
  assert.equal(existsSync("app/spazioporto.tsx"), false);
});
