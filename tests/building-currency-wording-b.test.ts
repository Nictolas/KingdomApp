import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("le seconde schermate edificio usano monete invece di crediti", () => {
  for (const path of [
    "app/impianto-riciclo.tsx",
    "app/ospedale.tsx",
    "app/scuola.tsx",
    "app/ufficio-edile.tsx"
  ]) {
    assert.doesNotMatch(readRepoFile(path), /crediti/i);
  }
});
