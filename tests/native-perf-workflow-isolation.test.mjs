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

test("source Git A/B isolation is enforced before running any native suites", () => {
  const gate = workflow.indexOf("Fail-closed A/B Git ancestry, engine isolation and four-blob fixture parity");
  const install = workflow.indexOf("      - run: npm ci");
  assert.ok(gate > 0 && gate < install);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /node --test tests\/native-ab-git-isolation\.test\.mjs/);
  assert.match(workflow, /node scripts\/audit-native-ab-git-isolation\.mjs/);
  for (const branch of [
    "perf/native-resident-imperative-motion-20261028",
    "perf/native-real-sprite-ab-baseline-20261028",
    "perf/native-resident-timer-batching-20261028"
  ]) assert.ok(workflow.includes(branch), "missing A/B ref " + branch);
  const script = readFileSync(new URL("../scripts/audit-native-ab-git-isolation.mjs", import.meta.url), "utf8");
  for (const path of [
    "app/native-perf.tsx",
    "src/performance/NativeRealResidentWorkload.tsx",
    "src/performance/nativeRealResidentFixture.ts",
    "tests/native-real-resident-fixture.test.ts"
  ]) assert.ok(script.includes(path), "missing Git-blob parity path " + path);
});

test("the three bundle jobs are smoke exports, not installable device builds", () => {
  assert.match(workflow, /platform: \[android, ios, web\]/);
  assert.match(workflow, /npx expo export --platform/);
  assert.doesNotMatch(workflow, /eas build|gradlew assembleRelease|xcodebuild archive/);
});


test("A/B isolation fails immediately on mismatched Git history instead of polling", () => {
  assert.doesNotMatch(workflow, /for attempt in 1 2 3 4 5 6; do/);
  assert.doesNotMatch(workflow, /sleep 10/);
  const script = readFileSync(new URL("../scripts/audit-native-ab-git-isolation.mjs", import.meta.url), "utf8");
  assert.match(script, /merge-base/);
  assert.match(script, /BASELINE_ALLOWLIST/);
  assert.match(script, /ENGINE_PATHS/);
  assert.match(script, /fixture Git blob mismatch/);
  assert.match(script, /candidate lacks a distinct optimized native timer queue/);
});

test("TypeScript additive gate does not prevent native suites and still fails the aggregate", () => {
  const gate = workflow.indexOf("      - name: Baseline TypeScript regression gate");
  const suite = workflow.indexOf("      - name: Pure fixture and frame metric tests");
  const aggregate = workflow.indexOf("      - name: Aggregate independent native suite outcomes");
  assert.ok(gate >= 0 && gate < suite && suite < aggregate);
  const gateText = workflow.slice(gate, suite);
  assert.ok(gateText.includes("id: typecheck_regression"));
  assert.ok(gateText.includes("continue-on-error: true"));
  assert.ok(gateText.includes("node scripts/check-native-typecheck-regressions.mjs"));
  const final = workflow.slice(aggregate);
  assert.ok(final.includes("typecheck_regression:" + "${{ steps.typecheck_regression.outcome }}"));
  assert.ok(final.includes("if: always()"));
  assert.ok(final.includes('if [[ "${outcome}" != "success" ]]'));
  assert.ok(final.includes('exit "${failed}"'));
});

test("RAF recovery stress assertion is type-safe after an earlier all-ones check", () => {
  const source = readFileSync(new URL("./native-resident-raf-rearm-fault.test.ts", import.meta.url), "utf8");
  assert.ok(source.includes("assert.deepEqual(counts, Array<number>(200).fill(2));"));
});

test("terminal cleanup regressions run in native route suite", () => {
  assert.ok(workflow.includes('      - "tests/native-resident-interruption-cleanup.test.ts"'));
  const route = workflow.slice(workflow.indexOf("      - name: Native commute/night priority"),
    workflow.indexOf("      - name: 200 real native resident sprite fixture"));
  assert.ok(route.includes("tests/native-resident-interruption-cleanup.test.ts"));
});

test("claimed-native-start rollback regressions are required in route suite", () => {
  assert.ok(workflow.includes('      - "tests/native-resident-claimed-start-fault.test.ts"'));
  const route = workflow.slice(workflow.indexOf("      - name: Native commute/night priority"),
    workflow.indexOf("      - name: 200 real native resident sprite fixture"));
  assert.ok(route.includes("tests/native-resident-claimed-start-fault.test.ts"));
});

test("native arrival failure occupancy recovery is required by the diagnostics workflow", () => {
  assert.ok(workflow.includes('      - "tests/native-resident-arrival-fault.test.ts"'));
  const routeSuite = workflow.slice(
    workflow.indexOf("      - name: Native commute/night priority"),
    workflow.indexOf("      - name: 200 real native resident sprite fixture")
  );
  assert.ok(routeSuite.includes("tests/native-resident-arrival-fault.test.ts"));
});

test("frame-time native occupancy fault recovery belongs to the required route suite", () => {
  assert.ok(workflow.includes('      - "tests/native-resident-frame-fault-occupancy.test.ts"'));
  const route = workflow.slice(workflow.indexOf("      - name: Native commute/night priority"),
    workflow.indexOf("      - name: 200 real native resident sprite fixture"));
  assert.ok(route.includes("tests/native-resident-frame-fault-occupancy.test.ts"));
});
