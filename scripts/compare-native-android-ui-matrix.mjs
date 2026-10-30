#!/usr/bin/env node
/**
 * Full 12-cell Android View-frame evidence matrix for native MyKingdom.
 * Baseline #298 and candidate #297 must be separate *real-sprite* builds.
 * This tool only analyzes explicitly supplied local dumps. It never calls adb,
 * guesses the device, certifies physical FPS, or modifies the repository.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeAndroidFrameStatsPairManifest } from "./analyze-native-android-framestats.mjs";

const POPULATIONS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];
const EXPECTED = POPULATIONS.flatMap(residents => SPEEDS.map(speed => residents + "/" + speed));
const fail = reason => { throw new Error("Android UI A/B matrix: " + reason); };

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

/**
 * Parsed gfxinfo CSV has no Git SHA or installed-build identity. Version 2
 * therefore requires explicit (UNVERIFIED) operator attestations to link its
 * Android View-latency evidence to the same #298/#297 pair as the JS matrix.
 * Version 1 is still readable but permanently marked preliminary.
 */
function auditAndroidUiBuildProvenance(manifest) {
  if (manifest.schemaVersion === 1) {
    return {
      level: "legacy_unverified", baseline: null, candidate: null,
      verification: "no_build_commit_attestation"
    };
  }
  const builds = manifest.builds;
  if (!builds || typeof builds !== "object" || Array.isArray(builds)) {
    fail("schemaVersion 2 requires builds.baseline and builds.candidate");
  }
  for (const [side, pr] of [["baseline", 298], ["candidate", 297]]) {
    const value = builds[side];
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        value.pr !== pr || typeof value.commit !== "string" ||
        !COMMIT_SHA.test(value.commit) ||
        value.installedOnPhysicalDeviceConfirmed !== true) {
      fail(side + " must attest PR #" + pr +
        ", a full Git commit SHA and installation on the physical Android device");
    }
  }
  if (builds.baseline.commit.toLowerCase() === builds.candidate.commit.toLowerCase()) {
    fail("baseline and candidate cannot refer to the same Git commit");
  }
  if (manifest.fixtureParityConfirmed !== true ||
      manifest.sameDeviceConditionsConfirmed !== true) {
    fail("fixtureParityConfirmed and sameDeviceConditionsConfirmed must be true");
  }
  return {
    level: "operator_attested",
    baseline: builds.baseline.commit.toLowerCase(),
    candidate: builds.candidate.commit.toLowerCase(),
    verification: "human_attestation_only_not_device_or_binary_verified"
  };
}

const validPath = path => typeof path === "string" && path.length > 0 &&
  path.length < 4096 && path === path.trim() && !path.startsWith("/") &&
  !/^[A-Za-z]:/.test(path) && !/[\\\r\n\0]/.test(path) &&
  path.split("/").every(part => part && part !== "." && part !== "..");

/**
 * A scenario contains 3–10 independent, alternating A/B capture pairs.
 * Pair parser validates time format, frame continuity and capture quality.
 * The matrix rejects path reuse across scenarios and never aggregates unlike
 * population/speed scenarios into one potentially misleading "gain" number.
 */
export function analyzeAndroidUiMatrix(manifest, load, { allowPartial = false } = {}) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      ![1, 2].includes(manifest.schemaVersion) || manifest.platform !== "android") {
    fail("schemaVersion 1 or 2 and platform android required");
  }
  if (manifest.samePhysicalDeviceConfirmed !== true) {
    fail("samePhysicalDeviceConfirmed must be explicitly attested");
  }
  const buildProvenance = auditAndroidUiBuildProvenance(manifest);
  if (![60, 90, 120, 144].includes(manifest.refreshHz)) {
    fail("refreshHz must be explicitly measured as 60, 90, 120 or 144");
  }
  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length < 1 ||
      manifest.scenarios.length > 12 || typeof load !== "function") {
    fail("1 to 12 scenarios and a local loader required");
  }
  if (typeof allowPartial !== "boolean") fail("invalid allowPartial");
  const seen = new Set();
  const paths = new Set();
  const scenarios = [];
  let captureFiles = 0;

  for (const entry of manifest.scenarios) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        !POPULATIONS.includes(entry.residents) || !SPEEDS.includes(entry.speed)) {
      fail("invalid population or speed");
    }
    const key = entry.residents + "/" + entry.speed;
    if (seen.has(key)) fail("duplicate scenario " + key);
    seen.add(key);
    if (!Array.isArray(entry.pairs) || entry.pairs.length < 3 || entry.pairs.length > 10) {
      fail(key + ": 3 to 10 A/B pairs required");
    }
    // No two manifest paths anywhere may label the same trial.
    for (const pair of entry.pairs) {
      if (!pair || typeof pair !== "object" || Array.isArray(pair) ||
          !validPath(pair.baseline) || !validPath(pair.candidate) ||
          pair.baseline === pair.candidate || paths.has(pair.baseline) ||
          paths.has(pair.candidate)) {
        fail(key + ": invalid, noncanonical or reused capture file path");
      }
      paths.add(pair.baseline);
      paths.add(pair.candidate);
      captureFiles += 2;
    }

    const result = analyzeAndroidFrameStatsPairManifest({
      schemaVersion: 1,
      platform: manifest.platform,
      scene: manifest.scene,
      residents: entry.residents,
      speed: entry.speed,
      refreshHz: manifest.refreshHz,
      samePhysicalDeviceConfirmed: manifest.samePhysicalDeviceConfirmed,
      pairs: entry.pairs
    }, load);
    scenarios.push({
      residents: entry.residents,
      speed: entry.speed,
      pairedCaptures: result.pairs.length,
      rawDumpFiles: result.pairs.length * 2,
      summary: result.summary,
      warnings: result.warnings,
      // A compact quality-only summary. Do not publish raw timestamps or paths.
      minFramesPerDump: Math.min(...result.pairs.flatMap(p => [p.baseline.frames, p.candidate.frames])),
      shortestObservedSpanMs: Math.min(...result.pairs.flatMap(p =>
        [p.baseline.observedSpanMs, p.candidate.observedSpanMs])),
      largestVsyncGapMs: Math.max(...result.pairs.flatMap(p =>
        [p.baseline.largestVsyncGapMs, p.candidate.largestVsyncGapMs]))
    });
  }
  const missing = EXPECTED.filter(key => !seen.has(key));
  if (missing.length && !allowPartial) {
    fail("incomplete 12-scenario matrix: " + missing.join(", ") +
      " (use --allow-partial only for preliminary review)");
  }
  scenarios.sort((a, b) => a.residents - b.residents || a.speed - b.speed);
  const warnings = scenarios.reduce((sum, s) => sum + s.warnings.length, 0);
  return {
    scope: "Android gfxinfo View completion latency ONLY; not GPU/UI FPS, touch latency, CPU or battery",
    comparison: "#298 real-sprite baseline vs #297 optimized native candidate",
    evidence: "operator_supplied_data_only_no_device_measurement_by_assistant",
    platform: manifest.platform,
    scene: manifest.scene,
    refreshHz: manifest.refreshHz,
    samePhysicalDevice: "human_attestation_only",
    coverage: {
      completed: scenarios.length, required: EXPECTED.length,
      missing, rawDumpFiles: captureFiles, minimumFullMatrixFiles: 72
    },
    status: missing.length ? "preliminary_incomplete" :
      buildProvenance.level === "legacy_unverified" ? "preliminary_legacy_manifest_no_build_provenance" :
      warnings ? "full_matrix_with_capture_quality_warnings" : "full_matrix_for_manual_review",
    buildProvenance,
    scenarios,
    conclusion: "no_automatic_performance_or_release_approval"
  };
}

function main(args) {
  let manifestPath = null;
  let json = false;
  let allowPartial = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest" && i + 1 < args.length) manifestPath = args[++i];
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--allow-partial") allowPartial = true;
    else fail("usage: --manifest matrix.json [--json] [--allow-partial]");
  }
  if (!manifestPath) fail("--manifest required");
  const fullPath = resolve(manifestPath);
  const raw = readFileSync(fullPath, "utf8");
  if (raw.length > 100_000) fail("manifest too large");
  const manifest = JSON.parse(raw);
  const root = realpathSync(dirname(fullPath));
  const canonicalReports = new Set();
  const load = path => {
    if (!validPath(path)) fail("invalid report path");
    const target = realpathSync(resolve(root, path));
    const inside = relative(root, target);
    if (!inside || inside === ".." || inside.startsWith(".." + sep) || isAbsolute(inside)) {
      fail("report path escapes manifest directory");
    }
    if (canonicalReports.has(target)) fail("same resolved file used for separate captures");
    canonicalReports.add(target);
    return readFileSync(target, "utf8");
  };
  const result = analyzeAndroidUiMatrix(manifest, load, { allowPartial });
  if (json) return console.log(JSON.stringify(result, null, 2));
  console.log("MyKingdom: Android View-frame A/B audit, NOT GPU/UI FPS");
  console.log("Provenance: " + result.buildProvenance.level +
    " (" + result.buildProvenance.verification + ")");
  console.log(result.coverage.completed + "/12 scenarios · " +
    result.coverage.rawDumpFiles + " local dumps · " + result.status);
  for (const scenario of result.scenarios) {
    console.log(scenario.residents + " residents at " + scenario.speed + "x · " +
      scenario.pairedCaptures + " pairs · median paired p95 delta " +
      scenario.summary.medianPairedP95DeltaMs + "ms · " +
      scenario.warnings.length + " quality warnings");
  }
  if (result.coverage.missing.length) console.log("Missing: " + result.coverage.missing.join(", "));
  console.log("Never approve release from these figures: verify real hardware, touch and GPU/UI tracing.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
