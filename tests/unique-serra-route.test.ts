import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

test("Expo Router: /serra has one owner and /serra/[id] remains available", () => {
  assert.equal(existsSync("app/serra.tsx"), true);
  assert.equal(existsSync("app/serra/index.tsx"), false, "Two owners of /serra cause a white screen");
  assert.equal(existsSync("app/serra/[id].tsx"), true);
});
