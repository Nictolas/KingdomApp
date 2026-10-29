#!/usr/bin/env node
/**
 * Read-only, offline Android View-rendering evidence for the MyKingdom
 * #298 (real sprite baseline) vs #297 (candidate) device lab.
 *
 * Android gfxinfo framestats timestamps are nanoseconds. Their difference
 * is UI frame completion latency, NOT GPU FPS, gameplay simulation FPS,
 * end-to-end input latency, or proof of a whole-game speedup.
 * No ADB calls, device identifiers, game state, storage writes or uploads.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const START = "---PROFILEDATA---";
const COLUMNS = ["Flags", "IntendedVsync", "FrameCompleted"];
const COUNTS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];
const SCENES = new Set([
  "Sprite abitanti reali in movimento",
  "Sprite abitanti reali in tragitto ripetibile",
  "Sprite abitanti reali fermi"
]);

const fail = reason => { throw new Error("Android framestats: " + reason); };
const median = sorted => sorted.length % 2
  ? sorted[(sorted.length - 1) / 2]
  : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const round = value => Math.round(value * 1000) / 1000;

function validPath(path) {
  return typeof path === "string" && path.length > 0 && path.length < 4096 &&
    path === path.trim() && !path.startsWith("/") &&
    !/^[A-Za-z]:/.test(path) && !/[\\\r\n\0]/.test(path) &&
    path.split("/").every(part => part && part !== "." && part !== "..");
}

/**
 * Parse one explicit framestats block. Android may dump multiple windows;
 * refuse to mix their frame streams. Select exactly one block when necessary.
 */
export function parseAndroidFrameStats(raw, { refreshHz = 60, blockIndex = null } = {}) {
  if (typeof raw !== "string" || !raw.length || raw.length > 4_000_000) fail("invalid raw dump size");
  if (![60, 90, 120, 144].includes(refreshHz)) fail("refreshHz must be 60, 90, 120 or 144");
  const blocks = [];
  let pos = 0;
  while (true) {
    const begin = raw.indexOf(START, pos);
    if (begin === -1) break;
    const end = raw.indexOf(START, begin + START.length);
    if (end === -1) fail("unclosed PROFILEDATA block");
    const lines = raw.slice(begin + START.length, end).trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const header = lines.shift()?.split(",").map(value => value.trim()) ?? [];
    if (!COLUMNS.every(field => header.includes(field))) fail("unsupported PROFILEDATA columns");
    const fields = Object.fromEntries(COLUMNS.map(field => [field, header.indexOf(field)]));
    const durations = [];
    const intended = [];
    let excludedFlags = 0;
    let malformed = 0;
    for (const line of lines) {
      const columns = line.split(",").map(value => value.trim());
      if (columns.length < header.length) { malformed++; continue; }
      const flag = columns[fields.Flags];
      if (!/^\d+$/.test(flag)) { malformed++; continue; }
      if (flag !== "0") { excludedFlags++; continue; }
      const start = columns[fields.IntendedVsync];
      const endTime = columns[fields.FrameCompleted];
      if (!/^\d+$/.test(start) || !/^\d+$/.test(endTime)) { malformed++; continue; }
      const first = BigInt(start);
      const last = BigInt(endTime);
      const diff = last - first;
      if (first === 0n || diff <= 0n || diff >= 100_000_000_000n) {
        malformed++;
        continue;
      }
      durations.push(Number(diff) / 1_000_000);
      intended.push(first);
    }
    blocks.push({ durations, intended, excludedFlags, malformed });
    pos = end + START.length;
  }
  if (!blocks.length) fail("no PROFILEDATA records found");
  if (blockIndex === null && blocks.length !== 1) fail("multiple windows: choose a blockIndex explicitly");
  if (blockIndex !== null && (!Number.isSafeInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length)) {
    fail("invalid PROFILEDATA blockIndex");
  }
  const item = blocks[blockIndex ?? 0];
  if (!item.durations.length) fail("no valid completed UI frames");
  const sorted = item.durations.sort((a, b) => a - b);
  const threshold = 1000 / refreshHz;
  const min = item.intended.reduce((a, b) => a < b ? a : b);
  const max = item.intended.reduce((a, b) => a > b ? a : b);
  const observedSpanMs = Number(max - min) / 1_000_000;
  // Span alone is not evidence of continuous sampling: a 10s interval with
  // one giant 8s hole is not a reliable ten-second View-frame distribution.
  // Sort BigInt timestamps without converting the absolute nanoseconds to
  // Number (they can exceed Number.MAX_SAFE_INTEGER).
  const byVsync = item.intended.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  let largestVsyncGapNs = 0n;
  let duplicatedVsyncFrames = 0;
  for (let i = 1; i < byVsync.length; i++) {
    const gap = byVsync[i] - byVsync[i - 1];
    if (gap === 0n) duplicatedVsyncFrames++;
    if (gap > largestVsyncGapNs) largestVsyncGapNs = gap;
  }
  const largestVsyncGapMs = Number(largestVsyncGapNs) / 1_000_000;
  const warnings = [];
  if (sorted.length < 60 || observedSpanMs < 8_000) {
    warnings.push("Short/rolling gfxinfo buffer: not a validated 10-second capture");
  }
  if (largestVsyncGapMs > 250) {
    warnings.push("Large gap between consecutive intended vsyncs: frame window continuity unverified");
  }
  if (duplicatedVsyncFrames > 0) {
    warnings.push("Duplicate intended-vsync timestamps: verify raw dump integrity");
  }
  return {
    metric: "Android View frame completion latency, NOT GPU FPS or app-level FPS",
    refreshHz,
    frameBudgetMs: round(threshold),
    frames: sorted.length,
    excludedFlags: item.excludedFlags,
    malformed: item.malformed,
    blocksFound: blocks.length,
    selectedBlock: blockIndex ?? 0,
    observedSpanMs: round(observedSpanMs),
    largestVsyncGapMs: round(largestVsyncGapMs),
    duplicatedVsyncFrames,
    medianMs: round(median(sorted)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    maxMs: round(sorted[sorted.length - 1]),
    framesOverBudget: sorted.filter(value => value > threshold).length,
    framesOverDoubleBudget: sorted.filter(value => value > 2 * threshold).length,
    overBudgetPercent: round(100 * sorted.filter(value => value > threshold).length / sorted.length),
    warning: warnings.length ? warnings.join("; ") : null
  };
}

export function analyzeAndroidFrameStatsPairManifest(manifest, load) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.schemaVersion !== 1 || manifest.platform !== "android") fail("invalid Android manifest");
  if (manifest.samePhysicalDeviceConfirmed !== true) fail("same physical device must be confirmed");
  if (![60, 90, 120, 144].includes(manifest.refreshHz)) fail("explicit display refresh rate required");
  if (!SCENES.has(manifest.scene) || !COUNTS.includes(manifest.residents) ||
      !SPEEDS.includes(manifest.speed)) fail("invalid real-sprite test scenario");
  if (!Array.isArray(manifest.pairs) || manifest.pairs.length < 3 || manifest.pairs.length > 10) {
    fail("3 to 10 independent baseline/candidate pairs required");
  }
  if (typeof load !== "function") fail("local file loader required");
  const files = new Set();
  const results = [];
  for (const pair of manifest.pairs) {
    if (!pair || !validPath(pair.baseline) || !validPath(pair.candidate) ||
        pair.baseline === pair.candidate || files.has(pair.baseline) || files.has(pair.candidate)) {
      fail("distinct, non-reused canonical relative report paths required");
    }
    files.add(pair.baseline);
    files.add(pair.candidate);
    const baseline = parseAndroidFrameStats(load(pair.baseline), { refreshHz: manifest.refreshHz });
    const candidate = parseAndroidFrameStats(load(pair.candidate), { refreshHz: manifest.refreshHz });
    if (baseline.frames < 30 || candidate.frames < 30) fail("insufficient UI frame evidence (<30)");
    results.push({
      baseline, candidate,
      p95DeltaMs: round(candidate.p95Ms - baseline.p95Ms),
      overBudgetDeltaPercentagePoints: round(candidate.overBudgetPercent - baseline.overBudgetPercent)
    });
  }
  const ordered = key => results.map(pair => pair[key]).sort((a, b) => a - b);
  const baselineP95 = results.map(pair => pair.baseline.p95Ms).sort((a, b) => a - b);
  const candidateP95 = results.map(pair => pair.candidate.p95Ms).sort((a, b) => a - b);
  const warnings = [];
  if (results.some(pair => pair.baseline.warning || pair.candidate.warning)) warnings.push("Short/rolling gfxinfo buffers; use Macrobenchmark/Perfetto for longer device measurements");
  if (results.some(pair => pair.baseline.malformed || pair.candidate.malformed)) warnings.push("Malformed rows excluded; inspect collection method");
  if (results.some(pair => pair.baseline.duplicatedVsyncFrames || pair.candidate.duplicatedVsyncFrames)) warnings.push("Duplicate intended-vsync timestamps: inspect raw trace");
  if (results.some(pair => pair.baseline.largestVsyncGapMs > 250 || pair.candidate.largestVsyncGapMs > 250)) warnings.push("Large intended-vsync gaps: continuous capture not established");
  return {
    scope: "Actual Android gfxinfo View frame completion latencies only; not JS/GPU FPS, whole-game FPS or touch latency",
    evidence: "device_output_supplied_by_user_not_device_measurement_by_assistant",
    comparison: "#298 real-sprite baseline vs #297 optimized candidate",
    platform: "android",
    scene: manifest.scene,
    residents: manifest.residents,
    speed: manifest.speed,
    refreshHz: manifest.refreshHz,
    samePhysicalDevice: "human_attestation_only",
    pairs: results,
    summary: {
      medianBaselineP95Ms: round(median(baselineP95)),
      medianCandidateP95Ms: round(median(candidateP95)),
      medianPairedP95DeltaMs: round(median(ordered("p95DeltaMs"))),
      medianPairedOverBudgetDeltaPercentagePoints: round(median(ordered("overBudgetDeltaPercentagePoints")))
    },
    warnings,
    conclusion: "requires_manual_review_no_automatic_performance_or_release_approval"
  };
}

function main(argv) {
  let path = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--manifest" && i + 1 < argv.length) path = argv[++i];
    else if (argv[i] === "--json") json = true;
    else fail("usage: --manifest /path/to/manifest.json [--json]");
  }
  if (!path) fail("manifest required");
  const fullPath = resolve(path);
  const raw = readFileSync(fullPath, "utf8");
  if (raw.length > 100_000) fail("manifest too large");
  const manifest = JSON.parse(raw);
  const root = realpathSync(dirname(fullPath));
  const load = file => {
    if (!validPath(file)) fail("invalid report path");
    const target = realpathSync(resolve(root, file));
    const inside = relative(root, target);
    if (!inside || inside === ".." || inside.startsWith(".." + sep) || isAbsolute(inside)) {
      fail("report path escapes manifest directory");
    }
    return readFileSync(target, "utf8");
  };
  const result = analyzeAndroidFrameStatsPairManifest(manifest, load);
  if (json) return console.log(JSON.stringify(result, null, 2));
  console.log("MyKingdom Android gfxinfo: latency of View frames, NOT GPU FPS");
  console.log(result.residents + " residents at " + result.speed + "x · " +
    result.pairs.length + " A/B pairs · " + result.refreshHz + " Hz");
  console.log("Median p95: baseline " + result.summary.medianBaselineP95Ms +
    " ms, candidate " + result.summary.medianCandidateP95Ms + " ms");
  console.log("Paired median delta p95: " + result.summary.medianPairedP95DeltaMs +
    " ms; display-budget delta: " + result.summary.medianPairedOverBudgetDeltaPercentagePoints + " pp");
  result.warnings.forEach(item => console.log("WARNING: " + item));
  console.log("No automatic acceptance; verify sampling, GPU/UI, touch and device conditions manually.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
