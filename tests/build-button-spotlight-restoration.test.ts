import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("dopo il suggerimento Ponte viene evidenziato Costruisci", () => {
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const spotlight = readFileSync("src/tutorial/TutorialSpotlightOverlay.tsx", "utf8");

  assert.match(context, /TutorialSpotlightProvider/);
  assert.match(context, /TutorialSpotlightOverlay/);
  assert.match(context, /MAPPA_COSTRUISCI/);
  assert.match(context, /showSpotlight/);
  assert.match(mappa, /useSpotlightTarget/);
  assert.match(mappa, /ref=\{costruisciSpotlightRef\}/);
  assert.match(mappa, /dismissSpotlight/);
  assert.match(spotlight, /fillRule="evenodd"/);
});
