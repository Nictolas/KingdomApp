import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseAndroidFrameStats,
  analyzeAndroidFrameStatsPairManifest
} from "../scripts/analyze-native-android-framestats.mjs";

const SCENE = "Sprite abitanti reali in tragitto ripetibile";

/** 120 synthetic Android View frames. Nanoseconds deliberately exceed JS's
 * MAX_SAFE_INTEGER: subtract BigInts BEFORE converting to milliseconds. */
function dump({
  frames = 120, durationMs = 14, stepMs = 16.667,
  flags = {}, malformedAt = -1, columnsReordered = false
} = {}) {
  const columns = columnsReordered
    ? ["FrameCompleted", "Flags", "IntendedVsync", "Extra"]
    : ["Flags", "IntendedVsync", "FrameCompleted"];
  const rows = [columns.join(",")];
  for (let frame = 0; frame < frames; frame++) {
    const intended = 10_000_000_000_000_000n + BigInt(Math.round(frame * stepMs * 1_000_000));
    const complete = intended + BigInt(Math.round(durationMs * 1_000_000));
    const values = { Flags: String(flags[frame] ?? 0), IntendedVsync: String(intended),
      FrameCompleted: String(complete), Extra: "0" };
    const row = columns.map(col => values[col]);
    if (frame === malformedAt) row[columns.indexOf("FrameCompleted")] = "-9";
    rows.push(row.join(","));
  }
  return "Profile data from a fake Android View\n---PROFILEDATA---\n" +
    rows.join("\n") + "\n---PROFILEDATA---\n";
}

function manifestFixture() {
  const files = new Map();
  const pairs = Array.from({ length: 3 }, (_, i) => {
    const baseline = "before-" + i + ".txt";
    const candidate = "after-" + i + ".txt";
    files.set(baseline, dump({ durationMs: 22 + i }));
    files.set(candidate, dump({ durationMs: 18 + i }));
    return { baseline, candidate };
  });
  return {
    manifest: {
      schemaVersion: 1, platform: "android", scene: SCENE,
      residents: 200, speed: 4, refreshHz: 60,
      samePhysicalDeviceConfirmed: true, pairs
    },
    files,
    load(name) {
      if (!files.has(name)) throw new Error("Missing test report " + name);
      return files.get(name);
    }
  };
}

test("Android 60 Hz frame completion: BigInt precision, p95 and over-budget counts", () => {
  const result = parseAndroidFrameStats(dump());
  assert.equal(result.frames, 120);
  assert.equal(result.medianMs, 14);
  assert.equal(result.p95Ms, 14);
  assert.equal(result.p99Ms, 14);
  assert.equal(result.framesOverBudget, 0);
  assert.equal(result.framesOverDoubleBudget, 0);
  assert.equal(result.excludedFlags, 0);
  assert.equal(result.malformed, 0);
  assert.equal(result.frameBudgetMs, 16.667);
  assert.ok(result.observedSpanMs > 1900);
  assert.match(result.metric, /NOT GPU FPS/);
  assert.equal(result.warning, null);
});

test("Android 90/120/144 Hz thresholds do not assume every display is 60 Hz", () => {
  for (const [hz, overBudget] of [[60, 0], [90, 120], [120, 120], [144, 120]]) {
    const result = parseAndroidFrameStats(dump({ durationMs: 14 }), { refreshHz: hz });
    assert.equal(result.framesOverBudget, overBudget);
  }
  assert.throws(() => parseAndroidFrameStats(dump(), { refreshHz: 75 }), /refreshHz/);
});

test("header order changes, nonzero flags and malformed rows are accounted for, not accepted silently", () => {
  const result = parseAndroidFrameStats(dump({
    frames: 120, durationMs: 20, flags: { 0: 1, 17: 2, 55: 1 },
    malformedAt: 61, columnsReordered: true
  }));
  assert.equal(result.frames, 116);
  assert.equal(result.excludedFlags, 3);
  assert.equal(result.malformed, 1);
  assert.equal(result.framesOverBudget, 116);
  assert.equal(result.framesOverDoubleBudget, 0);
});

test("short rolling buffers warn instead of pretending they represent ten seconds", () => {
  const short = parseAndroidFrameStats(dump({ frames: 35 }));
  assert.equal(short.frames, 35);
  assert.match(short.warning, /Short\/rolling/);
});

test("multiple View roots, missing blocks, impossible times and empty evidence fail closed", () => {
  assert.throws(() => parseAndroidFrameStats(dump() + dump()), /multiple windows/);
  assert.equal(parseAndroidFrameStats(dump() + dump({ durationMs: 19 }), { blockIndex: 1 }).p95Ms, 19);
  assert.throws(() => parseAndroidFrameStats(dump(), { blockIndex: 2 }), /blockIndex/);
  assert.throws(() => parseAndroidFrameStats("no frame data"), /no PROFILEDATA/);
  assert.throws(() => parseAndroidFrameStats("---PROFILEDATA---\nFlags,IntendedVsync,FrameCompleted\n"), /unclosed/);
  assert.throws(() => parseAndroidFrameStats(dump({ frames: 1, malformedAt: 0 })), /no valid completed/);
  assert.throws(() => parseAndroidFrameStats(dump({ frames: 1, durationMs: 120_000 })), /no valid completed/);
});

test("three paired #298/#297 runs yield reproducible, explicitly limited device metrics", () => {
  const { manifest, load } = manifestFixture();
  const result = analyzeAndroidFrameStatsPairManifest(manifest, load);
  assert.equal(result.pairs.length, 3);
  assert.equal(result.summary.medianBaselineP95Ms, 23);
  assert.equal(result.summary.medianCandidateP95Ms, 19);
  assert.equal(result.summary.medianPairedP95DeltaMs, -4);
  assert.ok(result.scope.includes("not JS/GPU FPS"));
  assert.equal(result.conclusion, "requires_manual_review_no_automatic_performance_or_release_approval");
  assert.equal(result.samePhysicalDevice, "human_attestation_only");
  assert.equal(result.pairs.every(pair => pair.baseline.frames === 120 && pair.candidate.frames === 120), true);
});

test("manifest rejects unverified hardware, wrong workload, reused paths and insufficient independent samples", () => {
  const { manifest, files, load } = manifestFixture();
  const original = JSON.parse(JSON.stringify(manifest));
  manifest.samePhysicalDeviceConfirmed = false;
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /same physical device/);
  Object.assign(manifest, original);
  manifest.scene = "marker baseline #295";
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /real-sprite/);
  manifest.scene = SCENE;
  manifest.speed = 8;
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /real-sprite/);
  manifest.speed = 4;
  manifest.pairs[1].baseline = manifest.pairs[0].baseline;
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /non-reused/);
  Object.assign(manifest, JSON.parse(JSON.stringify(original)));
  manifest.pairs.pop();
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /3 to 10/);
  manifest.pairs = original.pairs;
  files.set(manifest.pairs[0].candidate, dump({ frames: 25 }));
  assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /insufficient UI frame/);
});

test("report path traversal, aliases and filesystem symlinks cannot read outside a local manifest directory", () => {
  const { manifest, files, load } = manifestFixture();
  for (const name of ["../secret.txt", "./entry.txt", "a//b.txt", "/tmp/outside", "C:\\bad.txt", "a\\b", "a\nb"]) {
    manifest.pairs[0].baseline = name;
    assert.throws(() => analyzeAndroidFrameStatsPairManifest(manifest, load), /canonical relative/);
  }
  const root = mkdtempSync(join(tmpdir(), "mk-android-gfx-"));
  try {
    const inside = join(root, "reports");
    mkdirSync(inside);
    const fixed = manifestFixture();
    writeFileSync(join(root, "outside.txt"), fixed.files.get(fixed.manifest.pairs[0].baseline));
    symlinkSync(join(root, "outside.txt"), join(inside, fixed.manifest.pairs[0].baseline));
    for (const [filename, value] of fixed.files) {
      if (filename !== fixed.manifest.pairs[0].baseline) writeFileSync(join(inside, filename), value);
    }
    writeFileSync(join(inside, "manifest.json"), JSON.stringify(fixed.manifest));
    const proc = spawnSync(process.execPath, [
      resolve("scripts/analyze-native-android-framestats.mjs"),
      "--manifest", join(inside, "manifest.json"), "--json"
    ], { encoding: "utf8" });
    assert.equal(proc.status, 1);
    assert.match(proc.stderr, /escapes manifest directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI emits only aggregate evidence, no report path or device identifier", () => {
  const { manifest, files } = manifestFixture();
  const root = mkdtempSync(join(tmpdir(), "mk-android-gfx-cli-"));
  try {
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
    for (const [filename, value] of files) writeFileSync(join(root, filename), value);
    const proc = spawnSync(process.execPath, [
      resolve("scripts/analyze-native-android-framestats.mjs"),
      "--manifest", join(root, "manifest.json"), "--json"
    ], { encoding: "utf8" });
    assert.equal(proc.status, 0, proc.stderr);
    const output = JSON.parse(proc.stdout);
    assert.equal(output.pairs.length, 3);
    assert.ok(!proc.stdout.includes(root));
    assert.ok(!proc.stdout.includes("before-0.txt"));
    assert.equal(output.evidence, "device_output_supplied_by_user_not_device_measurement_by_assistant");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
