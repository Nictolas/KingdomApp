import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("le seconde schermate di policy usano monete invece di crediti", () => {
  for (const path of [
    "app/reddito-cittadinanza.tsx",
    "app/sanita.tsx",
    "app/tassa-reddito.tsx"
  ]) {
    assert.doesNotMatch(readRepoFile(path), /crediti/i);
  }
});
