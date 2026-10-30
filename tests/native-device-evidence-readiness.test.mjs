import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { auditNativeDeviceEvidence } from "../scripts/audit-native-device-evidence-readiness.mjs";

/** These are intentionally FABRICATED unit-test summaries, NOT device data. */
const A = "a".repeat(40);
const B = "b".repeat(40);
const scene = "Sprite abitanti reali in tragitto ripetibile";
const rows = () => [25, 50, 100, 200].flatMap(residents =>
  [1, 2, 4].map(speed => ({ residents, speed })));
const provenance = () => ({
  level: "operator_attested", baseline: A, candidate: B,
  verification: "human_attestation_only_not_device_or_binary_verified"
});
function complete() {
  const correctness = {
    status: "human_attestations_complete_review_still_required",
    commits: { baseline: A, candidate: B },
    failedObservations: 0,
    devices: ["android", "ios"].map(platform => ({
      platform, failedObservations: 0,
      coverage: { scenarios: 12, checks: 10, realMapChecks: 6 }
    }))
  };
  const js = platform => ({
    status: "js_diagnostics_ready_for_manual_device_review",
    platform, scene, buildProvenance: provenance(),
    coverage: { completed: 12, missing: [] },
    scenarios: rows().map(row => ({
      ...row, runs: { baseline: 3, candidate: 3 }, reviewMetrics: []
    }))
  });
  const androidUi = {
    status: "full_matrix_for_manual_review",
    platform: "android", scene, buildProvenance: provenance(),
    coverage: { completed: 12, missing: [] },
    scenarios: rows().map(row => ({ ...row, pairedCaptures: 3, warnings: [] }))
  };
  return { correctness, jsAndroid: js("android"), jsIos: js("ios"), androidUi };
}

test("no attachments: report exactly four absent evidence sources and never invent measurements", () => {
  const output = auditNativeDeviceEvidence();
  assert.equal(output.status, "incomplete_device_evidence");
  assert.deepEqual(output.missing, ["correctness", "jsAndroid", "jsIos", "androidUi"]);
  assert.equal(output.provenance, null);
  assert.match(output.scope, /NOT DEVICE/);
  assert.match(output.conclusion, /NEVER automatic release/);
});

test("a complete four-source synthetic JSON fixture yields only HUMAN manual review, never release approval", () => {
  const output = auditNativeDeviceEvidence(complete());
  assert.equal(output.status, "complete_human_evidence_for_manual_review");
  assert.deepEqual(output.missing, []);
  assert.deepEqual(output.review, []);
  assert.deepEqual(output.provenance, {
    baseline: A, candidate: B, verification: "human_attestation_only"
  });
  assert.equal(output.additionalManualEvidence.length, 3);
  assert.match(output.conclusion, /NEVER automatic release/);
});

test("both JS platforms and Android View frames must be bound to identical build commits", () => {
  for (const name of ["jsAndroid", "jsIos", "androidUi"]) {
    const data = complete();
    data[name].buildProvenance.candidate = "c".repeat(40);
    assert.throws(() => auditNativeDeviceEvidence(data), /different #298\/\#297 commits/);
  }
});

test("wrong or legacy metadata cannot certify the full Android/iOS evidence set", () => {
  const wrongPlatform = complete();
  wrongPlatform.jsIos.platform = "android";
  assert.throws(() => auditNativeDeviceEvidence(wrongPlatform), /wrong platform/);
  const legacy = complete();
  legacy.androidUi.buildProvenance.level = "legacy_unverified";
  legacy.androidUi.status = "preliminary_legacy_manifest_no_build_provenance";
  assert.throws(() => auditNativeDeviceEvidence(legacy), /requires explicitly attested/);
  const sceneMismatch = complete();
  sceneMismatch.androidUi.scene = "Sprite abitanti reali in movimento";
  assert.throws(() => auditNativeDeviceEvidence(sceneMismatch), /different real-sprite scenes/);
});

test("no source may relabel 11/12 or duplicated scenarios as a complete matrix", () => {
  const short = complete();
  short.jsAndroid.scenarios.pop();
  assert.throws(() => auditNativeDeviceEvidence(short), /complete 25\/50\/100\/200/);
  const duplicate = complete();
  duplicate.androidUi.scenarios[0] = { ...duplicate.androidUi.scenarios[1] };
  assert.throws(() => auditNativeDeviceEvidence(duplicate), /duplicated or invalid scenario/);
  const tooFewRuns = complete();
  tooFewRuns.jsIos.scenarios[3].runs.candidate = 2;
  assert.throws(() => auditNativeDeviceEvidence(tooFewRuns), /three independent captures/);
  const tooFewAndroidCaptures = complete();
  tooFewAndroidCaptures.androidUi.scenarios[3].pairedCaptures = 2;
  assert.throws(() => auditNativeDeviceEvidence(tooFewAndroidCaptures), /three Android View/);
});

test("manual 200-resident real-map checks remain mandatory beyond isolated sprite fixture", () => {
  const data = complete();
  data.correctness.devices[0].coverage.realMapChecks = 5;
  const output = auditNativeDeviceEvidence(data);
  assert.equal(output.status, "incomplete_device_evidence");
  assert.ok(output.missing.includes("complete_manual_android_ios_and_real_map_checks"));
});

test("incomparable captures and incomplete matrices cannot be silently treated as success", () => {
  const incomplete = complete();
  incomplete.jsIos.status = "preliminary_incomplete";
  incomplete.androidUi.status = "preliminary_legacy_manifest_no_build_provenance";
  const report = auditNativeDeviceEvidence(incomplete);
  assert.equal(report.status, "incomplete_device_evidence");
  assert.ok(report.missing.includes("jsIos_complete_v2_js_matrix"));
  assert.ok(report.missing.includes("androidUi_complete_v2_view_matrix"));
});

test("JS regressions and short/rolling Android frame captures require manual investigation", () => {
  const data = complete();
  data.jsAndroid.scenarios[0].reviewMetrics = ["frameP95Ms"];
  data.androidUi.status = "full_matrix_with_capture_quality_warnings";
  data.androidUi.scenarios[0].warnings = ["Short/rolling UI frame buffer"];
  const output = auditNativeDeviceEvidence(data);
  assert.deepEqual(output.missing, []);
  assert.equal(output.status, "complete_human_evidence_requires_investigation");
  assert.deepEqual(output.review, [
    "jsAndroid_js_regressions_need_review",
    "android_view_capture_quality_warnings"
  ]);
  const manualFault = complete();
  manualFault.correctness.failedObservations = 1;
  assert.ok(auditNativeDeviceEvidence(manualFault).review.includes("manual_failed_observations"));
});

test("missing correctness source never produces a complete physical-device comparison", () => {
  const data = complete();
  data.correctness = null;
  const output = auditNativeDeviceEvidence(data);
  assert.equal(output.status, "incomplete_device_evidence");
  assert.deepEqual(output.missing, ["correctness"]);
  assert.equal(output.provenance, null);
});

test("standalone CLI runs without any device data and exits 2 with a truthful missing-evidence report", () => {
  const run = spawnSync(process.execPath, [
    resolve("scripts/audit-native-device-evidence-readiness.mjs"), "--json"
  ], { encoding: "utf8" });
  assert.equal(run.status, 2, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, "incomplete_device_evidence");
  assert.equal(result.missing.length, 4);
  assert.ok(!run.stdout.includes("physical FPS measured"));
});
