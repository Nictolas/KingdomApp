import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("preview e schermate popolazione usano la lore del Regno", () => {
  const preview = readRepoFile("app/mappa-phaser-preview.tsx");
  const nativi = readRepoFile("app/nativi.tsx");
  const residenze = readRepoFile("app/residenze.tsx");
  const ricchezza = readRepoFile("app/ricchezza.tsx");

  assert.match(preview, /nome: "Castello"/);
  assert.doesNotMatch(preview, /Centro di Comando/);
  assert.doesNotMatch(nativi, /colonia/i);
  assert.doesNotMatch(residenze, /colonia|crediti|MW\/abitante/i);
  assert.doesNotMatch(ricchezza, /colonia/i);
});
