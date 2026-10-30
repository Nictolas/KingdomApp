import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { makeAndroidUiMatrixTemplate } from "../scripts/generate-native-android-ui-matrix-template.mjs";
import { analyzeAndroidUiMatrix } from "../scripts/compare-native-android-ui-matrix.mjs";

test("template generates all 12 scenarios and 72 unique, correctly paired filenames", () => {
  const template = makeAndroidUiMatrixTemplate();
  assert.equal(template.scenarios.length, 12);
  const paths = template.scenarios.flatMap(s => s.pairs.flatMap(p => [p.baseline, p.candidate]));
  assert.equal(paths.length, 72);
  assert.equal(new Set(paths).size, 72);
  assert.deepEqual(template.scenarios.map(x => x.residents + "/" + x.speed), [
    "25/1", "25/2", "25/4", "50/1", "50/2", "50/4",
    "100/1", "100/2", "100/4", "200/1", "200/2", "200/4"
  ]);
  assert.equal(template.schemaVersion, 2);
  assert.equal(template.refreshHz, null);
  assert.equal(template.samePhysicalDeviceConfirmed, false);
  assert.equal(template.fixtureParityConfirmed, false);
  assert.equal(template.sameDeviceConditionsConfirmed, false);
  assert.deepEqual(template.builds, {
    baseline: { pr: 298, commit: null, installedOnPhysicalDeviceConfirmed: false },
    candidate: { pr: 297, commit: null, installedOnPhysicalDeviceConfirmed: false }
  });
  assert.throws(() => analyzeAndroidUiMatrix(template, () => ""), /samePhysicalDeviceConfirmed/);
  assert.match(template.baselineBranch, /native-real-sprite-ab-baseline/);
  assert.match(template.candidateBranch, /native-resident-timer-batching/);
});

test("requested 10 capture pairs generate 240 non-reused file names but cannot attest a device", () => {
  const template = makeAndroidUiMatrixTemplate({ pairs: 10 });
  assert.equal(template.scenarios.length, 12);
  assert.equal(template.scenarios.flatMap(s => s.pairs).length, 120);
  const names = template.scenarios.flatMap(s => s.pairs.flatMap(p => [p.baseline, p.candidate]));
  assert.equal(names.length, 240);
  assert.equal(new Set(names).size, 240);
  assert.equal(template.samePhysicalDeviceConfirmed, false);
  assert.equal(template.refreshHz, null);
});

test("invalid pair count and marker-only scene cannot enter the real-sprite manifest", () => {
  for (const pairs of [0, 2, 11, 3.1, NaN, Infinity, "3"]) {
    assert.throws(() => makeAndroidUiMatrixTemplate({ pairs }), /3–10/);
  }
  assert.throws(() => makeAndroidUiMatrixTemplate({ scene: "Marker fermi" }), /real native-sprite/i);
});

test("CLI emits JSON, and never fabricates refresh rate or same-device attestation", () => {
  const script = resolve("scripts/generate-native-android-ui-matrix-template.mjs");
  const run = spawnSync(process.execPath, [script, "--pairs", "4"], {encoding:"utf8"});
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.scenarios.length, 12);
  assert.equal(output.scenarios[0].pairs.length, 4);
  assert.equal(output.refreshHz, null);
  assert.equal(output.samePhysicalDeviceConfirmed, false);
  assert.equal(output.schemaVersion, 2);
  assert.equal(output.builds.baseline.commit, null);
  assert.equal(output.builds.candidate.commit, null);
  assert.equal(output.builds.baseline.installedOnPhysicalDeviceConfirmed, false);
  assert.equal(output.builds.candidate.installedOnPhysicalDeviceConfirmed, false);
  assert.equal(JSON.stringify(output).includes("measuredFPS"), false);
  const invalid = spawnSync(process.execPath, [script, "--pairs", "1"], {encoding:"utf8"});
  assert.equal(invalid.status, 1);
});
