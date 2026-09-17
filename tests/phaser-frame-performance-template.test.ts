import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("BK-017 results template includes all target scenarios", () => {
  const text = readFileSync("docs/BK017_PERF_RESULTS_TEMPLATE.md", "utf8");
  for (const scenario of ["Idle zoom 1", "Continuous pan", "Repeated zoom", "Pan + moving characters", "Dense area"]) {
    assert.match(text, new RegExp(scenario.replace(/[+]/g, "\\+")));
  }
});
