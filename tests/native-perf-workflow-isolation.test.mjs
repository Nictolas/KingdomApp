import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/native-perf-diagnostics.yml", import.meta.url), "utf8"
);

test("all native test suites run independently and their failures are aggregated", () => {
  const groups = [...workflow.matchAll(
    /^      - name: (.+)\n        id: (suite_\d+)\n        continue-on-error: true$/gm
  )];
  assert.ok(groups.length >= 12, "independent native test groups are missing");
  const ids = groups.map(match => match[2]);
  assert.equal(new Set(ids).size, ids.length);
  const final = workflow.slice(workflow.indexOf("      - name: Aggregate independent native suite outcomes"));
  assert.ok(final.startsWith("      - name: Aggregate independent native suite outcomes"));
  assert.match(final, /if: always\(\)/);
  assert.match(final, /if \[\[ "\$\{outcome\}" != "success" \]\]/);
  assert.match(final, /exit "\$\{failed\}"/);
  for (const id of ids) {
    assert.ok(final.includes("steps." + id + ".outcome"),
      "failure for " + id + " would otherwise be ignored");
  }
});

test("A/B fixture parity is enforced before running native suites", () => {
  const gate = workflow.indexOf("A/B real-sprite fixture parity against paired lab branch");
  const install = workflow.indexOf("      - run: npm ci");
  assert.ok(gate > 0 && gate < install);
  for (const path of [
    "app/native-perf.tsx",
    "src/performance/NativeRealResidentWorkload.tsx",
    "src/performance/nativeRealResidentFixture.ts",
    "tests/native-real-resident-fixture.test.ts"
  ]) {
    assert.ok(workflow.includes(path), "missing A/B fixture parity path " + path);
  }
});

test("the three bundle jobs are smoke exports, not installable device builds", () => {
  assert.match(workflow, /platform: \[android, ios, web\]/);
  assert.match(workflow, /npx expo export --platform/);
  assert.doesNotMatch(workflow, /eas build|gradlew assembleRelease|xcodebuild archive/);
});
