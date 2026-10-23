import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const map = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
const portrait = readFileSync(new URL("../src/ui/ResidentPortrait.tsx", import.meta.url), "utf8");

test("resident panel grows only when an inhabitant is selected", () => {
  assert.match(map, /styles\.bottomBarInner, sintesiMappaAbitante && styles\.bottomBarInnerResident/);
  assert.match(map, /bottomBarInnerResident:\s*\{\s*height: 230,/);
  assert.match(map, /bottomBarInner:\s*\{[\s\S]*?height: Platform\.OS === "web" \? 150 : 128,/);
  assert.match(map, /sintesiAbitanteFooter:\s*\{[\s\S]*?minHeight: 46/);
});

test("resident identity shows LPC portrait instead of an emoji", () => {
  const residentStart = map.indexOf("{sintesiMappaAbitante ? (");
  const residentEnd = map.indexOf("<ScrollView", residentStart);
  assert.ok(residentStart >= 0 && residentEnd > residentStart);
  const residentBlock = map.slice(residentStart, residentEnd);
  assert.match(residentBlock, /<ResidentPortrait abitante=\{sintesiMappaAbitante\} nudismoAttivo=\{nudismoAttivo\}/);
  assert.doesNotMatch(residentBlock, /styles\.sintesiEmoji/);
  assert.match(residentBlock, /accessibilityLabel="Individua sulla mappa"/);
  assert.match(residentBlock, /accessibilityLabel="Apri scheda completa"/);
});

test("portrait reuses the correct appearance, face crop and a static frame", () => {
  assert.match(portrait, /aspettoPerVisualizzazioneAbitante\(abitante, \{ nudismoAttivo \}\)/);
  assert.match(portrait, /canRenderCharacter\(appearance, "idle"\)/);
  assert.match(portrait, /<CircularSpriteFrame[\s\S]*?direction="down"[\s\S]*?animate=\{false\}[\s\S]*?faceOnly/);
  assert.match(portrait, /abitante\.razza === "Golem"/);
});
