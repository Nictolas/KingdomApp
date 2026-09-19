import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la selezione abitante Phaser viene aggiornata anche senza full rerender", () => {
  const source = readFileSync("src/phaser/scenes/KingdomMapScene.ts", "utf8");

  assert.match(
    source,
    /if \(changes\.interaction\) this\.renderInteraction\(snapshot\);\s*this\.renderLocateMarker\(snapshot\);\s*this\.renderSelectionMarker\(snapshot\);/
  );

  assert.match(
    source,
    /this\.chatBusy\.clear\(\);\s*this\.clearSelectionRing\(\);\s*this\.clearLocateArrow\(\);/
  );
});
