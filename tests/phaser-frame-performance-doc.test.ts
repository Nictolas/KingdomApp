import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("BK-017 performance guide documents the perf query flag", () => {
  const text = readFileSync("docs/BK017_PERF_TEST.md", "utf8");
  assert.match(text, /\?perf=1/);
  assert.match(text, /p95 frame time/);
  assert.match(text, /continuous pan/);
});
