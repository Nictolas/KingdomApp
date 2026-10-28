import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shared = read("../src/components/MapWandererCharacter.tsx");
const native = read("../src/components/MapWandererCharacter.native.tsx");
const map = read("../app/mappa.tsx");

function propsSignature(source: string): string {
  const match = source.match(/type MapWandererCharacterProps = \{[\s\S]*?\n\};/);
  assert.ok(match, "Component must export the same resident props type");
  return match[0];
}

test("native-specific movement does not alter the web resident renderer", () => {
  assert.ok(!shared.includes("Animated.ValueXY"), "the web/default resident renderer should retain state-based position");
  assert.ok(!shared.includes("PendingCommuteRetry"), "the web/default resident renderer must not inherit the experiment");
  assert.match(shared, /setPixelPos\(/);
  assert.match(native, /Animated\.ValueXY/);
  assert.match(native, /PauseAwareMotionClock/);
  assert.match(native, /PendingCommuteRetry/);
});

test("native/default residents share an identical prop contract", () => {
  assert.equal(propsSignature(native), propsSignature(shared));
});

test("map imports resident component without an extension, for Metro platform resolution", () => {
  assert.match(map, /from ["']\.\.\/src\/components\/MapWandererCharacter["']/);
  assert.ok(!map.includes("MapWandererCharacter.native.tsx"));
});
