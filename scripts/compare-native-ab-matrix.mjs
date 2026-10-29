#!/usr/bin/env node
/**
 * Offline A/B matrix audit for the REAL native resident sprite laboratory.
 * No network calls, game state, device identifiers or FPS/GPU assertions.
 * Baseline = #298, candidate = #297. #295 is markers-only.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { compareNativeJsReports, parseNativeJsReports } from "./compare-native-js-reports.mjs";

const POPULATIONS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];
const SCENES = new Set(["Sprite abitanti reali in movimento", "Sprite abitanti reali fermi", "Sprite abitanti reali in tragitto ripetibile"]);
const expectedKeys = POPULATIONS.flatMap(residents => SPEEDS.map(speed => residents + "/" + speed));
const fail = message => { throw new Error("Native A/B matrix: " + message); };
// Canonical relative paths only: reject aliases, traversal and absolute paths.
const isPath = value => typeof value === "string" && value.length > 0 &&
  value.length <= 4096 && value.trim() === value &&
  !/[\\\r\n\0]/.test(value) && !value.startsWith("/") &&
  !/^[A-Za-z]:/.test(value) &&
  value.split("/").every(part => part !== "" && part !== "." && part !== "..");

export function analyzeNativeAbMatrix(manifest, loadText, { allowPartial = false } = {}) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (!["android", "ios"].includes(manifest.platform)) fail("platform must be android or ios");
  if (!SCENES.has(manifest.scene)) fail("only real native sprite scenes can be compared");
  if (manifest.samePhysicalDeviceConfirmed !== true) {
    fail("samePhysicalDeviceConfirmed must be explicitly acknowledged");
  }
  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length < 1 ||
      manifest.scenarios.length > expectedKeys.length) fail("expected 1 to 12 scenarios");
  if (typeof loadText !== "function") fail("a local report loader is required");

  const seen = new Set();
  const usedFiles = new Set();
  const scenarios = [];
  for (const entry of manifest.scenarios) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        !POPULATIONS.includes(entry.residents) || !SPEEDS.includes(entry.speed)) {
      fail("invalid scenario population or simulation speed");
    }
    const key = entry.residents + "/" + entry.speed;
    if (seen.has(key)) fail("duplicate scenario " + key);
    seen.add(key);
    if (!isPath(entry.baseline) || !isPath(entry.candidate) ||
        entry.baseline === entry.candidate) fail(key + ": two distinct local report files are required");
    if (usedFiles.has(entry.baseline) || usedFiles.has(entry.candidate)) {
      fail(key + ": a report file cannot be reused across scenarios");
    }
    usedFiles.add(entry.baseline);
    usedFiles.add(entry.candidate);

    const baselineText = loadText(entry.baseline);
    const candidateText = loadText(entry.candidate);
    const baseline = parseNativeJsReports(baselineText);
    const candidate = parseNativeJsReports(candidateText);
    // #298 has no recorded speed in its historical HUD; require a separate
    // human acknowledgement rather than silently claiming parity.
    const unrecordedBaseline = baseline.some(run => run.timeScale === null);
    const unrecordedCandidate = candidate.some(run => run.timeScale === null);
    if (unrecordedBaseline && entry.baselineSpeedConfirmed !== true) {
      fail(key + ": baseline speed absent; set baselineSpeedConfirmed only after manual verification");
    }
    if (unrecordedCandidate && entry.candidateSpeedConfirmed !== true) {
      fail(key + ": candidate speed absent; set candidateSpeedConfirmed only after manual verification");
    }
    const comparison = compareNativeJsReports(baselineText, candidateText);
    const { scenario, runs } = comparison;
    if (scenario.platform !== manifest.platform || scenario.scene !== manifest.scene ||
        scenario.residents !== entry.residents || scenario.terrainCells !== 400 ||
        scenario.durationMs !== 10000 ||
        (scenario.speed !== null && scenario.speed !== entry.speed)) {
      fail(key + ": report metadata differs from the declared 10-second, 400-cell scenario");
    }
    if (runs.baseline < 3 || runs.candidate < 3) {
      fail(key + ": at least three independent captures are required on each build");
    }
    if (baseline.some(run => run.samples < 100) || candidate.some(run => run.samples < 100)) {
      fail(key + ": fewer than 100 JS frame samples in a capture");
    }
    // A report can claim 10 seconds while containing only ~2 seconds of
    // 16ms frames. Count alone (>=100) cannot detect such missing intervals.
    // The exported mean is rounded to 0.1ms, so use a generous 80–115%
    // envelope rather than falsely promising exact wall-clock coverage.
    for (const [side, captures] of [["baseline", baseline], ["candidate", candidate]]) {
      for (const run of captures) {
        const coverage = run.samples * run.metrics.frameMeanMs / run.durationMs;
        if (!Number.isFinite(coverage) || coverage < 0.80 || coverage > 1.15) {
          fail(key + ": " + side + " JS RAF samples do not cover the declared capture window (80–115%)");
        }
      }
    }
    // #298 may lack the later probes, but #297's strict HUD must never be
    // compared as a complete candidate when its heartbeat or dispatch data
    // is absent. Stationary sprites legitimately produce zero RAF batches.
    const moving = manifest.scene !== "Sprite abitanti reali fermi";
    if (candidate.some(run =>
      run.metrics.frameBatchP95Ms === null ||
      run.metrics.eventLoopLagP95Ms === null ||
      run.diagnosticSamples.frameBatch === null ||
      run.diagnosticSamples.eventLoopLag === null ||
      run.diagnosticSamples.eventLoopLag < 1 ||
      (moving && run.diagnosticSamples.frameBatch < 1))) {
      fail(key + ": candidate #297 missing required JS dispatch/event-loop probe evidence");
    }
    scenarios.push({
      residents: entry.residents, speed: entry.speed, runs,
      speedConfirmedManually: unrecordedBaseline || unrecordedCandidate,
      reviewMetrics: comparison.metrics.filter(metric => metric.review).map(metric => metric.key),
      metrics: comparison.metrics,
      warnings: comparison.warnings
    });
  }
  const missing = expectedKeys.filter(key => !seen.has(key));
  if (missing.length && !allowPartial) fail("incomplete 12-scenario matrix: " + missing.join(", ") +
    " (use --allow-partial for an explicitly preliminary audit)");
  scenarios.sort((a, b) => a.residents - b.residents || a.speed - b.speed);
  return {
    scope: "OFFLINE JS diagnostic evidence only; no native UI/GPU FPS, touch latency, GC or battery claims",
    comparison: "#298 real-sprite baseline versus #297 optimized real-sprite candidate",
    platform: manifest.platform,
    scene: manifest.scene,
    deviceMatch: "human_attestation_only_not_technically_verified",
    coverage: { completed: scenarios.length, required: expectedKeys.length, missing },
    status: missing.length ? "preliminary_incomplete" : "js_diagnostics_ready_for_manual_device_review",
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
  if (!manifestPath) fail("--manifest is required");
  const path = resolve(manifestPath);
  const raw = readFileSync(path, "utf8");
  if (raw.length > 100000) fail("manifest too large");
  const manifest = JSON.parse(raw);
  const root = realpathSync(dirname(path));
  const load = file => {
    const target = realpathSync(resolve(root, file));
    const within = relative(root, target);
    // realpath resolves symlinks; reject any escape from the manifest folder.
    if (!within || within === ".." || within.startsWith(".." + sep) ||
      isAbsolute(within)) fail("report path escapes manifest directory");
    return readFileSync(target, "utf8");
  };
  const result = analyzeNativeAbMatrix(manifest, load, { allowPartial });
  if (json) return console.log(JSON.stringify(result, null, 2));
  console.log("MyKingdom · matrice A/B JS nativa (NON FPS UI/GPU)");
  console.log(result.platform + " · " + result.scene + " · " +
    result.coverage.completed + "/" + result.coverage.required + " scenari");
  for (const item of result.scenarios) {
    console.log(item.residents + " abitanti · " + item.speed + "x · " +
      item.runs.baseline + "/" + item.runs.candidate + " prove · " +
      (item.reviewMetrics.length ? "VERIFICARE: " + item.reviewMetrics.join(", ") : "nessuna regressione JS segnalata"));
  }
  if (result.coverage.missing.length) console.log("Mancanti: " + result.coverage.missing.join(", "));
  console.log("Solo diagnostica JS; validare touch, collisioni e FPS UI/GPU su dispositivo reale.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
