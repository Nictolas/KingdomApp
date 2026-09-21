import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("le prime schermate edificio usano monete invece di crediti", () => {
  for (const path of [
    "app/caserma.tsx",
    "app/centrale.tsx",
    "app/dissalatore.tsx",
    "app/laboratorio.tsx"
  ]) {
    assert.doesNotMatch(readRepoFile(path), /crediti/i);
  }
});
