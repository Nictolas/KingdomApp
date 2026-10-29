import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { analyzeAndroidUiMatrix } from "../scripts/compare-native-android-ui-matrix.mjs";

const SCENE = "Sprite abitanti reali in tragitto ripetibile";
const POPULATIONS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];

function dump({ duration = 20, frames = 600, gapAt = -1 } = {}) {
  const rows = ["Flags,IntendedVsync,FrameCompleted"];
  let offset = 0n;
  for (let i = 0; i < frames; i++) {
    if (i === gapAt) offset += 5_000_000_000n;
    const timestamp = 10_000_000_000_000_000n + BigInt(Math.round(i * 16.667 * 1_000_000)) + offset;
    rows.push("0," + timestamp + "," + (timestamp + BigInt(Math.round(duration * 1_000_000))));
  }
  return "---PROFILEDATA---\n" + rows.join("\n") + "\n---PROFILEDATA---\n";
}

function fixture({ full = true, short = false, pairsCount = 3 } = {}) {
  const files = new Map();
  const scenarios = [];
  for (const residents of POPULATIONS) for (const speed of SPEEDS) {
    if (!full && !(residents === 200 && speed === 4)) continue;
    const pairs = [];
    for (let trial = 0; trial < pairsCount; trial++) {
      const key = residents + "-" + speed + "-" + trial;
      const baseline = "baseline-" + key + ".txt";
      const candidate = "candidate-" + key + ".txt";
      files.set(baseline, dump({ duration: 23 + speed + trial, frames: short ? 120 : 600 }));
      files.set(candidate, dump({ duration: 20 + speed + trial, frames: short ? 120 : 600 }));
      pairs.push({ baseline, candidate });
    }
    scenarios.push({ residents, speed, pairs });
  }
  return {
    manifest: {
      schemaVersion: 1, platform: "android", scene: SCENE, refreshHz: 60,
      samePhysicalDeviceConfirmed: true, scenarios
    },
    files,
    load(name) {
      if (!files.has(name)) throw new Error("Unknown fixture");
      return files.get(name);
    }
  };
}

test("12 scenarios × three A/B pairs = 72 synthetic dumps, separated by population/speed", () => {
  const f = fixture();
  const result = analyzeAndroidUiMatrix(f.manifest, f.load);
  assert.deepEqual(result.coverage, {
    completed: 12, required: 12, missing: [], rawDumpFiles: 72,
    minimumFullMatrixFiles: 72
  });
  assert.equal(result.status, "full_matrix_for_manual_review");
  assert.equal(result.scenarios.length, 12);
  assert.ok(result.scenarios.every(s => s.pairedCaptures === 3 && s.rawDumpFiles === 6));
  assert.ok(result.scenarios.every(s => s.summary.medianPairedP95DeltaMs === -3));
  assert.ok(result.scenarios.every(s => s.warnings.length === 0));
  assert.equal(result.scenarios.at(0).residents, 25);
  assert.equal(result.scenarios.at(-1).residents, 200);
  assert.equal(result.conclusion, "no_automatic_performance_or_release_approval");
  assert.match(result.scope, /not GPU\/UI FPS/);
});

test("incomplete matrix is explicitly preliminary and otherwise fails closed", () => {
  const f = fixture({ full: false });
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load), /incomplete 12-scenario matrix/);
  const result = analyzeAndroidUiMatrix(f.manifest, f.load, { allowPartial: true });
  assert.equal(result.coverage.completed, 1);
  assert.equal(result.coverage.rawDumpFiles, 6);
  assert.equal(result.coverage.missing.length, 11);
  assert.equal(result.status, "preliminary_incomplete");
});

test("capture-quality warnings propagate without claiming the comparison is passed", () => {
  const f = fixture({ short: true });
  const result = analyzeAndroidUiMatrix(f.manifest, f.load);
  assert.equal(result.coverage.completed, 12);
  assert.equal(result.status, "full_matrix_with_capture_quality_warnings");
  assert.ok(result.scenarios.every(s => s.warnings.some(w => /Short\/rolling/.test(w))));
  const first = f.manifest.scenarios[0].pairs[0].candidate;
  f.files.set(first, dump({ frames: 600, gapAt: 280 }));
  const second = analyzeAndroidUiMatrix(f.manifest, f.load);
  assert.ok(second.scenarios[0].warnings.some(w => w.includes("Large intended-vsync gaps")));
  assert.equal(second.conclusion, "no_automatic_performance_or_release_approval");
});

test("wrong scene, fake device attestation, unsupported refresh, population or speed fail", () => {
  const f = fixture({ full: false });
  const entry = f.manifest.scenarios[0];
  f.manifest.samePhysicalDeviceConfirmed = false;
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /samePhysicalDeviceConfirmed/);
  f.manifest.samePhysicalDeviceConfirmed = true;
  f.manifest.scene = "Marker #295";
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /invalid real-sprite/);
  f.manifest.scene = SCENE;
  f.manifest.refreshHz = 75;
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /refreshHz/);
  f.manifest.refreshHz = 60;
  entry.residents = 201;
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /invalid population/);
  entry.residents = 200;
  entry.speed = 8;
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /invalid population/);
  entry.speed = 4;
});

test("duplicate scenarios, cross-scenario file reuse and invalid local paths fail closed", () => {
  const f = fixture({ full: false });
  const first = f.manifest.scenarios[0];
  f.manifest.scenarios.push({ ...first });
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /duplicate scenario/);
  f.manifest.scenarios[1] = {
    ...first, residents: 100, pairs: first.pairs.map(x => ({...x}))
  };
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /reused capture/);
  f.manifest.scenarios.pop();
  for (const bad of ["../escape", "./a", "a/../b", "a//b", "/tmp/raw", "C:\\raw", "a\nb", "a\\b"]) {
    first.pairs[0].baseline = bad;
    assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /noncanonical/);
  }
});

test("missing/invalid or too many per-scenario captures cannot masquerade as three valid trials", () => {
  const f = fixture({ full: false });
  const entry = f.manifest.scenarios[0];
  entry.pairs.pop();
  assert.throws(() => analyzeAndroidUiMatrix(f.manifest, f.load, {allowPartial:true}), /3 to 10/);
  const second = fixture({ full: false, pairsCount: 11 });
  assert.throws(() => analyzeAndroidUiMatrix(second.manifest, second.load, {allowPartial:true}), /3 to 10/);
  const third = fixture({ full: false });
  const broken = third.manifest.scenarios[0].pairs[0].candidate;
  third.files.set(broken, "missing raw frames");
  assert.throws(() => analyzeAndroidUiMatrix(third.manifest, third.load, {allowPartial:true}), /no PROFILEDATA/);
});

test("CLI supports deliberate partial review, emits no path or device ID", () => {
  const f = fixture({ full: false });
  const root = mkdtempSync(join(tmpdir(), "mykingdom-android-matrix-"));
  try {
    for (const [path, value] of f.files) writeFileSync(join(root, path), value);
    const manifest = join(root, "matrix.json");
    writeFileSync(manifest, JSON.stringify(f.manifest));
    const script = resolve("scripts/compare-native-android-ui-matrix.mjs");
    const rejected = spawnSync(process.execPath, [script, "--manifest", manifest, "--json"], {encoding:"utf8"});
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /incomplete 12-scenario matrix/);
    const accepted = spawnSync(process.execPath, [
      script, "--manifest", manifest, "--allow-partial", "--json"
    ], {encoding:"utf8"});
    assert.equal(accepted.status, 0, accepted.stderr);
    const output = JSON.parse(accepted.stdout);
    assert.equal(output.coverage.completed, 1);
    assert.ok(!accepted.stdout.includes(root));
    assert.ok(!accepted.stdout.includes("baseline-200-4-0.txt"));
    assert.equal(output.samePhysicalDevice, "human_attestation_only");
  } finally {
    rmSync(root, {recursive:true, force:true});
  }
});

test("CLI rejects symlink escapes and canonical aliases of the same raw dump", () => {
  const f = fixture({ full: false });
  const root = mkdtempSync(join(tmpdir(), "mykingdom-android-matrix-symlink-"));
  const inside = join(root, "inside");
  try {
    mkdirSync(inside);
    const original = f.manifest.scenarios[0].pairs[0].baseline;
    writeFileSync(join(root, "outside.txt"), f.files.get(original));
    symlinkSync(join(root, "outside.txt"), join(inside, original));
    for (const [path, value] of f.files) {
      if (path !== original) writeFileSync(join(inside, path), value);
    }
    const manifest = join(inside, "matrix.json");
    writeFileSync(manifest, JSON.stringify(f.manifest));
    const script = resolve("scripts/compare-native-android-ui-matrix.mjs");
    const escaped = spawnSync(process.execPath, [
      script, "--manifest", manifest, "--allow-partial"
    ], {encoding:"utf8"});
    assert.equal(escaped.status, 1);
    assert.match(escaped.stderr, /escapes manifest directory/);

    rmSync(join(inside, original));
    // Two different manifest names resolving to one file are not independent captures.
    const other = f.manifest.scenarios[0].pairs[1].baseline;
    symlinkSync(join(inside, other), join(inside, original));
    const aliased = spawnSync(process.execPath, [
      script, "--manifest", manifest, "--allow-partial"
    ], {encoding:"utf8"});
    assert.equal(aliased.status, 1);
    assert.match(aliased.stderr, /same resolved file used/);
  } finally {
    rmSync(root, {recursive:true, force:true});
  }
});
