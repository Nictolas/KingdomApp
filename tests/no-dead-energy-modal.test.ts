import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("il vecchio EnergiaModal non esiste più ma la risorsa Energia resta simulata", () => {
  assert.equal(existsSync("src/ui/EnergiaModal.tsx"), false);

  const simulazione = readFileSync("src/game/avanzaMese.ts", "utf8");
  assert.match(simulazione, /risorsa\.nome === "Energia"/);
});
