import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("le prime schermate di policy usano monete invece di crediti", () => {
  for (const path of [
    "app/crimine.tsx",
    "app/divieto-espatrio.tsx",
    "app/eta-pensionabile.tsx",
    "app/felicita.tsx"
  ]) {
    assert.doesNotMatch(readRepoFile(path), /crediti/i);
  }
});
