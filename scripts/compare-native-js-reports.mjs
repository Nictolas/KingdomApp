#!/usr/bin/env node
/**
 * Offline comparison of MyKingdom native JS diagnostics collected on devices.
 *
 * Usage:
 *   node scripts/compare-native-js-reports.mjs --baseline before.txt --candidate after.txt
 *   node scripts/compare-native-js-reports.mjs --baseline before.txt --candidate after.txt --json
 *
 * Each file contains 1+ complete "Condividi risultati" reports concatenated
 * together. 3+ runs per side are recommended. No telemetry or network IO.
 *
 * This compares JS callback/RAF evidence ONLY. The parser cannot establish
 * phone identity, physical touch latency, UI/GPU frame pacing or GC improvement.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HEADER = "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)";
const MAX_REPORT_BYTES = 5_000_000;

// Strict units and unique fields: never accept numeric prefixes such as
// "20e9", "1x4" or "600garbage" as a legitimate captured metric.
const NUMBER_UNITS = new Map([
  ["Durata", "s"], ["Velocità simulazione", "x"],
  ["Frame medio", "ms"], ["p95", "ms"],
  ["Batch RAF JS p95", "ms"], ["Batch timer JS p95", "ms"],
  ["Ritardo loop JS p95", "ms"], ["Gestore tocchi JS p95", "ms"]
]);

const uniqueField = (text, label, required) => {
  const matches = text.split("\n").filter(line => line.startsWith(label + ":"));
  if (matches.length > 1) throw new Error("Duplicate report field: " + label);
  if (!matches.length) {
    if (required) throw new Error("Report missing required field: " + label);
    return null;
  }
  return matches[0].slice(label.length + 1).trim();
};

const numberField = (text, label, required = false) => {
  const value = uniqueField(text, label, required);
  if (value === null) return null;
  const match = value.match(/^(-?\d+(?:\.\d+)?)(?:\s*(ms|s|x))?$/);
  if (!match) throw new Error("Report contains nonnumeric field: " + label);
  if ((match[2] ?? "") !== (NUMBER_UNITS.get(label) ?? "")) {
    throw new Error("Invalid metric unit: " + label);
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid metric: " + label);
  return number;
};

const textField = (text, label) => {
  const value = uniqueField(text, label, true);
  if (!value) throw new Error("Empty field: " + label);
  return value;
};

export function parseNativeJsReports(input) {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_REPORT_BYTES) {
    throw new Error("Expected a nonempty diagnostic text file of at most 5 MB");
  }
  const start = input.indexOf(HEADER);
  if (start < 0) throw new Error("No MyKingdom native JS diagnostic report found");
  const blocks = input.slice(start).split(HEADER).slice(1);
  if (blocks.length > 60) throw new Error("Too many reports (limit 60)");
  return blocks.map((body, index) => {
    // Never parse values from another report when this one is incomplete.
    const text = HEADER + body;
    const platform = textField(text, "Piattaforma");
    const scene = textField(text, "Scena");
    const residents = numberField(text, "Elementi", true);
    const terrainCells = numberField(text, "Celle terreno");
    const durationSeconds = numberField(text, "Durata", true);
    const samples = numberField(text, "Campioni", true);
    const timeScale = numberField(text, "Velocità simulazione");
    if (!["ios", "android"].includes(platform.toLowerCase()) ||
      !Number.isSafeInteger(residents) || residents < 0 ||
      (terrainCells !== null && !Number.isSafeInteger(terrainCells)) ||
      durationSeconds <= 0 || samples < 0 || !Number.isSafeInteger(samples) ||
      (timeScale !== null && ![0, 1, 2, 4].includes(timeScale))) {
      throw new Error("Invalid metadata in report " + (index + 1));
    }
    const frameMeanMs = numberField(text, "Frame medio", true);
    const frameP95Ms = numberField(text, "p95", true);
    const framesOver50 = numberField(text, "Frame oltre 50 ms", true);
    const framesOver33 = numberField(text, "Frame oltre 33 ms");
    const reportedJsFps = numberField(text, "FPS JS medio");
    if (samples < framesOver50 || frameMeanMs === null || frameP95Ms === null ||
      !Number.isSafeInteger(framesOver50) ||
      (framesOver33 !== null && (!Number.isSafeInteger(framesOver33) ||
        framesOver33 > samples || framesOver33 < framesOver50)) ||
      (samples > 0 && (frameMeanMs <= 0 || frameP95Ms <= 0)) ||
      (reportedJsFps !== null && samples > 0 &&
        (reportedJsFps <= 0 ||
          Math.abs(reportedJsFps - 1000 / frameMeanMs) >
            Math.max(1.5, 0.06 * (1000 / frameMeanMs))))) {
      throw new Error("Invalid JS frame counts in report " + (index + 1));
    }
    // Counts are optional for historical #298 reports, but the #297 A/B
    // candidate must carry complete dispatch and event-loop evidence.
    // A p95 value without its sample count is not sufficient proof.
    const diagnosticSamples = {
      frameBatch: numberField(text, "Batch RAF JS campionati"),
      eventLoopLag: numberField(text, "Ritardo loop JS campioni")
    };
    if (Object.values(diagnosticSamples).some(value =>
      value !== null && !Number.isSafeInteger(value))) {
      throw new Error("Invalid diagnostic probe sample counts in report " + (index + 1));
    }
    const metrics = {
      frameMeanMs,
      frameP95Ms,
      framesOver50Pct: samples > 0 ? 100 * framesOver50 / samples : null,
      frameBatchP95Ms: numberField(text, "Batch RAF JS p95"),
      timerBatchP95Ms: numberField(text, "Batch timer JS p95"),
      eventLoopLagP95Ms: numberField(text, "Ritardo loop JS p95"),
      touchCallbackP95Ms: numberField(text, "Gestore tocchi JS p95")
    };
    return {
      platform: platform.toLowerCase(), scene, residents, terrainCells,
      durationMs: durationSeconds * 1000, samples, timeScale, metrics, diagnosticSamples
    };
  });
}

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function describeGroup(items, side) {
  if (!items.length) throw new Error(side + ": no report found");
  const first = items[0];
  const keys = ["platform", "scene", "residents", "terrainCells", "durationMs"];
  for (const report of items) {
    for (const key of keys) {
      if (report[key] !== first[key]) {
        throw new Error(side + ": mixed " + key + " values — compare one scenario at a time");
      }
    }
  }
  const speeds = new Set(items.map(x => x.timeScale).filter(x => x !== null));
  if (speeds.size > 1 || (speeds.size > 0 && items.some(x => x.timeScale === null))) {
    throw new Error(side + ": mixed/unknown simulation speeds — compare one speed at a time");
  }
  return { ...first, recordedSpeed: speeds.size === 1 ? [...speeds][0] : null };
}

export function compareNativeJsReports(baselineText, candidateText) {
  const baseline = parseNativeJsReports(baselineText);
  const candidate = parseNativeJsReports(candidateText);
  const before = describeGroup(baseline, "baseline");
  const after = describeGroup(candidate, "candidate");
  const dimensions = ["platform", "scene", "residents", "terrainCells", "durationMs"];
  for (const key of dimensions) {
    if (before[key] !== after[key]) {
      throw new Error("Incomparable reports: " + key + " differs between baseline and candidate");
    }
  }
  if (before.recordedSpeed !== null && after.recordedSpeed !== null &&
    before.recordedSpeed !== after.recordedSpeed) {
    throw new Error("Incomparable simulation speeds: baseline " + before.recordedSpeed +
      "x, candidate " + after.recordedSpeed + "x");
  }
  const warnings = [];
  if (before.recordedSpeed === null || after.recordedSpeed === null) {
    warnings.push("Simulation speed is not recorded in both versions; manually verify identical 0x/1x/2x/4x settings.");
  }
  if (baseline.length < 3 || candidate.length < 3) {
    warnings.push("Preliminary comparison: collect at least three independent 10-second runs per version.");
  }
  if ([...baseline, ...candidate].some(x => x.samples < 100)) {
    warnings.push("At least one capture has fewer than 100 JS frame samples; inspect low-rate sessions individually.");
  }
  warnings.push("Device identity, physical input-to-screen latency, heap/GC and UI/GPU FPS cannot be verified from these reports.");
  const descriptors = [
    ["frameP95Ms", "JS frame p95 (ms)"],
    ["frameMeanMs", "JS frame average (ms)"],
    ["framesOver50Pct", "JS frames >50ms (%)"],
    ["frameBatchP95Ms", "Resident RAF JS batch p95 (ms)"],
    ["timerBatchP95Ms", "Timer JS batch p95 (ms)"],
    ["eventLoopLagP95Ms", "JS event-loop delay p95 (ms)"],
    ["touchCallbackP95Ms", "Pressable JS handler p95 (ms)"]
  ];
  const metrics = descriptors.flatMap(([key, label]) => {
    const a = baseline.map(x => x.metrics[key]);
    const b = candidate.map(x => x.metrics[key]);
    // Baseline #295 lacks newer batch probes; never silently interpret a
    // missing metric as zero or a performance improvement.
    if (a.some(x => x === null) || b.some(x => x === null)) return [];
    const oldMedian = median(a);
    const newMedian = median(b);
    const delta = newMedian - oldMedian;
    const deltaPct = oldMedian > 0 ? 100 * delta / oldMedian : null;
    // A heuristic REVIEW flag, not a statistical or product acceptance gate.
    const review = delta > Math.max(key === "framesOver50Pct" ? 2 : 2, oldMedian * 0.15);
    const variability = Math.max(
      Math.max(...a) - Math.min(...a),
      Math.max(...b) - Math.min(...b)
    );
    if (variability > Math.max(2, oldMedian * 0.2)) {
      warnings.push(label + ": large run-to-run variability; compare more repeated measurements.");
    }
    return [{ key, label, baselineMedian: oldMedian, candidateMedian: newMedian,
      change: delta, changePercent: deltaPct, review }];
  });
  return {
    scope: "JavaScript RAF/handler timings only; NOT native UI/GPU FPS or physical touch latency",
    scenario: { platform: before.platform, scene: before.scene, residents: before.residents,
      terrainCells: before.terrainCells, durationMs: before.durationMs,
      speed: before.recordedSpeed ?? after.recordedSpeed },
    runs: { baseline: baseline.length, candidate: candidate.length },
    metrics,
    warnings: [...new Set(warnings)],
    conclusion: "advisory_only_requires_real_device_repetition_and_visual_correctness_review"
  };
}

function main(args) {
  let baseline = null;
  let candidate = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") json = true;
    else if (arg === "--baseline" && i + 1 < args.length) baseline = args[++i];
    else if (arg === "--candidate" && i + 1 < args.length) candidate = args[++i];
    else throw new Error("Usage: node scripts/compare-native-js-reports.mjs --baseline before.txt --candidate after.txt [--json]");
  }
  if (!baseline || !candidate) throw new Error("Both --baseline and --candidate report files are required");
  const a = readFileSync(resolve(baseline), "utf8");
  const b = readFileSync(resolve(candidate), "utf8");
  const result = compareNativeJsReports(a, b);
  if (json) return console.log(JSON.stringify(result, null, 2));
  console.log("MyKingdom · confronto diagnostica JS (NON FPS GPU/UI)");
  console.log(result.scenario.platform + " · " + result.scenario.scene + " · " +
    result.scenario.residents + " elementi · " + result.scenario.durationMs / 1000 + " s");
  console.log(result.runs.baseline + " misure baseline, " + result.runs.candidate + " misure candidate");
  for (const m of result.metrics) {
    console.log(m.label + ": " + m.baselineMedian.toFixed(2) + " → " +
      m.candidateMedian.toFixed(2) + " (" +
      (m.changePercent === null ? "n/a" : m.changePercent.toFixed(1) + "%") +
      (m.review ? "; VERIFICARE possibile regressione" : "") + ")");
  }
  for (const warning of result.warnings) console.log("Attenzione: " + warning);
  console.log("Il confronto non prova aumento FPS, migliore risposta touch fisica o minore uso GPU/CPU.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error("Confronto non valido: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
