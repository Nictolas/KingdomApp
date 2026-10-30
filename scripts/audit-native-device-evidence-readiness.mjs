#!/usr/bin/env node
/**
 * Cross-check OFFLINE summaries from the existing three device-evidence
 * analyzers. Never reads a device, installs builds, or approves releases.
 * Even a complete result consists of operator-entered, unverified claims.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const POPULATIONS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];
const EXPECTED = POPULATIONS.flatMap(p => SPEEDS.map(s => p + "/" + s));
const SHA = /^[a-f0-9]{40}$/i;
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
const fail = message => { throw new Error("Native device evidence: " + message); };

function identity(ref, baseline, candidate, source) {
  if (!isObject(ref) || ref.level !== "operator_attested" ||
      !SHA.test(ref.baseline ?? "") || !SHA.test(ref.candidate ?? "")) {
    fail(source + " requires explicitly attested, full build commit SHAs");
  }
  if (ref.baseline.toLowerCase() !== baseline ||
      ref.candidate.toLowerCase() !== candidate) {
    fail(source + " refers to different #298/#297 commits than device correctness");
  }
}

function scenarios(report, source, runsKey) {
  if (!isObject(report.coverage) || report.coverage.completed !== 12 ||
      !Array.isArray(report.coverage.missing) || report.coverage.missing.length ||
      !Array.isArray(report.scenarios) || report.scenarios.length !== 12) {
    fail(source + " does not contain the complete 25/50/100/200 x 1/2/4 matrix");
  }
  const seen = new Set();
  for (const row of report.scenarios) {
    const key = row?.residents + "/" + row?.speed;
    if (!EXPECTED.includes(key) || seen.has(key)) fail(source + " duplicated or invalid scenario " + key);
    seen.add(key);
    if (runsKey === "runs") {
      if (!isObject(row.runs) || row.runs.baseline < 3 || row.runs.candidate < 3) {
        fail(source + " requires three independent captures per build and scenario");
      }
    } else if (!Number.isInteger(row.pairedCaptures) || row.pairedCaptures < 3) {
      fail(source + " requires three Android View-framestats pairs per scenario");
    }
  }
  return report.scenarios;
}

/**
 * Optional JSON results are from:
 *   audit-native-device-acceptance.mjs
 *   compare-native-ab-matrix.mjs (one per platform)
 *   compare-native-android-ui-matrix.mjs
 * An absent source is missing evidence, never an implicit pass.
 */
export function auditNativeDeviceEvidence({
  correctness = null, jsAndroid = null, jsIos = null, androidUi = null
} = {}) {
  const missing = [];
  const review = [];
  const sources = { correctness, jsAndroid, jsIos, androidUi };
  for (const [name, result] of Object.entries(sources)) {
    if (result === null) missing.push(name);
    else if (!isObject(result)) fail(name + " must be a parsed JSON result");
  }
  let baseline = null;
  let candidate = null;
  if (correctness !== null) {
    const commits = correctness.commits;
    if (!isObject(commits) || !SHA.test(commits.baseline ?? "") ||
        !SHA.test(commits.candidate ?? "") ||
        commits.baseline.toLowerCase() === commits.candidate.toLowerCase()) {
      fail("correctness requires distinct full #298/#297 commit SHAs");
    }
    baseline = commits.baseline.toLowerCase();
    candidate = commits.candidate.toLowerCase();
    if (correctness.failedObservations !== 0) {
      review.push("manual_failed_observations");
    }
    if (correctness.status !== "human_attestations_complete_review_still_required" ||
        !Array.isArray(correctness.devices) || correctness.devices.length !== 2 ||
        !correctness.devices.some(d => d.platform === "android") ||
        !correctness.devices.some(d => d.platform === "ios") ||
        correctness.devices.some(d => !isObject(d.coverage) ||
          d.coverage.scenarios !== 12 || d.coverage.checks !== 10 ||
          d.coverage.realMapChecks !== 6 || d.failedObservations !== 0)) {
      missing.push("complete_manual_android_ios_and_real_map_checks");
    }
  }
  // When correctness is absent, don't trust the unanchored provenance in
  // another result; the output stays incomplete.
  for (const [name, report, platform] of [
    ["jsAndroid", jsAndroid, "android"],
    ["jsIos", jsIos, "ios"]
  ]) {
    if (report === null) continue;
    if (report.platform !== platform || !isObject(report.buildProvenance)) {
      fail(name + " has wrong platform or missing build provenance");
    }
    if (baseline !== null) identity(report.buildProvenance, baseline, candidate, name);
    else if (report.buildProvenance.level !== "operator_attested") missing.push(name + "_commit_provenance");
    if (report.status !== "js_diagnostics_ready_for_manual_device_review") {
      missing.push(name + "_complete_v2_js_matrix");
    } else {
      const rows = scenarios(report, name, "runs");
      if (rows.some(row => Array.isArray(row.reviewMetrics) && row.reviewMetrics.length)) {
        review.push(name + "_js_regressions_need_review");
      }
    }
  }
  if (androidUi !== null) {
    if (androidUi.platform !== "android" || !isObject(androidUi.buildProvenance)) {
      fail("androidUi has wrong platform or missing build provenance");
    }
    if (baseline !== null) identity(androidUi.buildProvenance, baseline, candidate, "androidUi");
    else if (androidUi.buildProvenance.level !== "operator_attested") missing.push("androidUi_commit_provenance");
    if (jsAndroid !== null && jsAndroid.scene !== androidUi.scene) {
      fail("Android JS and View-framestats captures use different real-sprite scenes");
    }
    if (!["full_matrix_for_manual_review", "full_matrix_with_capture_quality_warnings"].includes(androidUi.status)) {
      missing.push("androidUi_complete_v2_view_matrix");
    } else {
      const rows = scenarios(androidUi, "androidUi", "pairedCaptures");
      if (androidUi.status === "full_matrix_with_capture_quality_warnings" ||
          rows.some(row => Array.isArray(row.warnings) && row.warnings.length)) {
        review.push("android_view_capture_quality_warnings");
      }
    }
  }
  const uniqMissing = [...new Set(missing)];
  const uniqReview = [...new Set(review)];
  return {
    scope: "CROSS-CHECK OF HUMAN ATTESTATIONS AND OFFLINE JS/ANDROID VIEW SUMMARIES; NOT DEVICE, GPU/FPS OR BUILD VERIFICATION",
    comparison: "#298 real native sprites vs #297 timer-batched real native sprites",
    expected: { populations: POPULATIONS, speeds: SPEEDS, platforms: ["android", "ios"] },
    provenance: baseline !== null ? { baseline, candidate, verification: "human_attestation_only" } : null,
    missing: uniqMissing,
    review: uniqReview,
    status: uniqMissing.length ? "incomplete_device_evidence" :
      uniqReview.length ? "complete_human_evidence_requires_investigation" :
        "complete_human_evidence_for_manual_review",
    additionalManualEvidence: [
      "iOS Instruments / Core Animation and responsiveness (not parsed here)",
      "Android GPU FrameTimeline/Perfetto beyond gfxinfo rolling View frames",
      "real-map correctness, real device identity and thermal conditions independently reviewed"
    ],
    conclusion: "NEVER automatic release, merge, performance improvement or physical FPS claim"
  };
}

function main(args) {
  const names = new Map([
    ["--correctness", "correctness"], ["--js-android", "jsAndroid"],
    ["--js-ios", "jsIos"], ["--android-ui", "androidUi"]
  ]);
  const data = {};
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") { json = true; continue; }
    const field = names.get(args[i]);
    if (!field || !args[i + 1] || data[field]) {
      fail("usage: [--correctness result.json] [--js-android result.json] [--js-ios result.json] [--android-ui result.json] [--json]");
    }
    const filename = args[++i];
    const raw = readFileSync(resolve(filename), "utf8");
    if (raw.length > 2_000_000) fail(field + " summary exceeds 2 MB");
    data[field] = JSON.parse(raw);
  }
  const result = auditNativeDeviceEvidence(data);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("MyKingdom device evidence: " + result.status);
    console.log("Missing: " + (result.missing.join(", ") || "none"));
    console.log("Manual review flags: " + (result.review.join(", ") || "none"));
    console.log(result.conclusion);
  }
  // The CLI is a read-only coverage tool; incompleteness is not success.
  if (result.missing.length) process.exitCode = 2;
  else if (result.review.length) process.exitCode = 3;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
