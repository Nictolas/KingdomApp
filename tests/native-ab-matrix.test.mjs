import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { analyzeNativeAbMatrix } from "../scripts/compare-native-ab-matrix.mjs";

const SCENE = "Sprite abitanti reali in movimento";
const populations = [25, 50, 100, 200];
const speeds = [1, 2, 4];

function report({ residents = 200, speed = 1, p95 = 20, samples = 600,
  platform = "android", scene = SCENE, terrain = 400, duration = 10 } = {}) {
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    "Piattaforma: " + platform,
    "Scena: " + scene,
    "Elementi: " + residents,
    "Celle terreno: " + terrain,
    ...(speed === null ? [] : ["Velocità simulazione: " + speed + "x"]),
    "Durata: " + duration + " s",
    "Campioni: " + samples,
    "Frame medio: 16 ms",
    "p95: " + p95 + " ms",
    "Frame oltre 50 ms: 3",
    "Batch RAF JS campionati: 100",
    "Batch RAF JS p95: 3 ms",
    "Ritardo loop JS campioni: 20",
    "Ritardo loop JS p95: 4 ms",
    "Nota: questi NON sono FPS UI/GPU"
  ].join("\n");
}
const triple = options => Array.from({ length: 3 }, (_, i) => report({ ...options, p95: (options?.p95 ?? 20) + i })).join("\n---\n");

function matrix({ full = true, baselineSpeed = 1, candidateSpeed = 1 } = {}) {
  const scenarios = [];
  const files = new Map();
  for (const residents of populations) for (const speed of speeds) {
    if (!full && (residents !== 200 || speed !== 1)) continue;
    const key = residents + "-" + speed;
    const baseline = "before-" + key + ".txt";
    const candidate = "after-" + key + ".txt";
    files.set(baseline, triple({ residents, speed: baselineSpeed === "actual" ? speed : baselineSpeed }));
    files.set(candidate, triple({ residents, speed: candidateSpeed === "actual" ? speed : candidateSpeed, p95: 19 }));
    scenarios.push({
      residents, speed, baseline, candidate,
      baselineSpeedConfirmed: true,
      candidateSpeedConfirmed: true
    });
  }
  return {
    manifest: {
      schemaVersion: 1, platform: "android", scene: SCENE,
      samePhysicalDeviceConfirmed: true, scenarios
    },
    files,
    load: name => {
      if (!files.has(name)) throw new Error("Missing fixture " + name);
      return files.get(name);
    }
  };
}

const BASELINE_SHA = "6dfcb12337992418f812049bf4bc1e1c144f843c";
const CANDIDATE_SHA = "14e0387ad149cd96f64e2cda0d60e140ed186703";

/** Manual attestation only: fixture tests cannot establish device identity. */
function attestV2(manifest) {
  manifest.schemaVersion = 2;
  manifest.fixtureParityConfirmed = true;
  manifest.sameDeviceConditionsConfirmed = true;
  manifest.builds = {
    baseline: { pr: 298, commit: BASELINE_SHA, installedOnPhysicalDeviceConfirmed: true },
    candidate: { pr: 297, commit: CANDIDATE_SHA, installedOnPhysicalDeviceConfirmed: true }
  };
  return manifest;
}

test("complete 72-capture v2 matrix reports distinct operator-attested build SHAs without claiming binary proof", () => {
  const { manifest, load } = matrix({ baselineSpeed: "actual", candidateSpeed: "actual" });
  attestV2(manifest);
  const result = analyzeNativeAbMatrix(manifest, load);
  assert.equal(result.coverage.completed, 12);
  assert.equal(result.status, "js_diagnostics_ready_for_manual_device_review");
  assert.deepEqual(result.buildProvenance, {
    level: "operator_attested",
    baseline: BASELINE_SHA,
    candidate: CANDIDATE_SHA,
    verification: "human_attestation_only_not_binary_or_device_verified"
  });
  assert.equal(result.deviceMatch, "human_attestation_only_not_technically_verified");
  assert.equal(result.conclusion, "no_automatic_performance_or_release_approval");
});

test("legacy v1 complete matrix remains preliminary without build provenance", () => {
  const { manifest, load } = matrix({ baselineSpeed: "actual", candidateSpeed: "actual" });
  const result = analyzeNativeAbMatrix(manifest, load);
  assert.equal(result.coverage.completed, 12);
  assert.equal(result.status, "preliminary_legacy_manifest_no_build_provenance");
  assert.equal(result.buildProvenance.level, "legacy_unverified");
  assert.equal(result.buildProvenance.baseline, null);
});

test("v2 refuses missing/wrong PRs, malformed/equal SHAs and missing device/fixture attestations", () => {
  const corruptions = [
    manifest => { delete manifest.builds; },
    manifest => { manifest.builds = []; },
    manifest => { manifest.builds.baseline.pr = 295; },
    manifest => { manifest.builds.candidate.pr = 298; },
    manifest => { manifest.builds.baseline.commit = "short"; },
    manifest => { manifest.builds.candidate.commit = "x".repeat(40); },
    manifest => { manifest.builds.candidate.commit = BASELINE_SHA.toUpperCase(); },
    manifest => { manifest.builds.baseline.installedOnPhysicalDeviceConfirmed = false; },
    manifest => { manifest.builds.candidate.installedOnPhysicalDeviceConfirmed = null; },
    manifest => { manifest.fixtureParityConfirmed = false; },
    manifest => { manifest.sameDeviceConditionsConfirmed = false; }
  ];
  for (const corrupt of corruptions) {
    const { manifest, load } = matrix({ full: false });
    attestV2(manifest);
    corrupt(manifest);
    assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
      /builds\.baseline|must attest|same Git commit|fixtureParityConfirmed/,
      "invalid v2 provenance must fail closed");
  }
});

test("CLI v2 emits attested build SHAs, but never certifies installed binaries or FPS", () => {
  const { manifest, files } = matrix({ full: false });
  attestV2(manifest);
  const dir = mkdtempSync(join(tmpdir(), "mk-native-ab-v2-"));
  try {
    writeFileSync(join(dir, "matrix.json"), JSON.stringify(manifest));
    for (const [name, content] of files) writeFileSync(join(dir, name), content);
    const result = spawnSync(process.execPath, [
      resolve("scripts/compare-native-ab-matrix.mjs"),
      "--manifest", join(dir, "matrix.json"), "--allow-partial", "--json"
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, "preliminary_incomplete");
    assert.equal(parsed.buildProvenance.baseline, BASELINE_SHA);
    assert.equal(parsed.buildProvenance.candidate, CANDIDATE_SHA);
    assert.match(parsed.buildProvenance.verification, /human_attestation_only/);
    assert.equal(parsed.conclusion, "no_automatic_performance_or_release_approval");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v2 partial matrix is still preliminary regardless of build attestations", () => {
  const { manifest, load } = matrix({ full: false });
  attestV2(manifest);
  const result = analyzeNativeAbMatrix(manifest, load, { allowPartial: true });
  assert.equal(result.status, "preliminary_incomplete");
  assert.equal(result.buildProvenance.level, "operator_attested");
});

test("full 25/50/100/200 × 1x/2x/4x matrix: 72 local captures, no GPU claims", () => {
  const { manifest, load } = matrix({ baselineSpeed: "actual", candidateSpeed: "actual" });
  const result = analyzeNativeAbMatrix(manifest, load);
  assert.deepEqual(result.coverage, { completed: 12, required: 12, missing: [] });
  assert.equal(result.scenarios.length, 12);
  assert.ok(result.scenarios.every(x => x.runs.baseline === 3 && x.runs.candidate === 3));
  assert.ok(result.scope.includes("no native UI/GPU FPS"));
  assert.equal(result.conclusion, "no_automatic_performance_or_release_approval");
  assert.equal(result.deviceMatch, "human_attestation_only_not_technically_verified");
});

test("repeatable commute scene is accepted but cannot be mixed with random roaming reports", () => {
  const { manifest, files, load } = matrix({ full: true, baselineSpeed: "actual", candidateSpeed: "actual" });
  const repeatable = "Sprite abitanti reali in tragitto ripetibile";
  manifest.scene = repeatable;
  for (const [path, text] of files) files.set(path, text.replaceAll(SCENE, repeatable));
  const result = analyzeNativeAbMatrix(manifest, load);
  assert.equal(result.coverage.completed, 12);
  assert.equal(result.scene, repeatable);
  const candidate = manifest.scenarios[0].candidate;
  files.set(candidate, files.get(candidate).replaceAll(repeatable, SCENE));
  assert.throws(() => analyzeNativeAbMatrix(manifest, load), /Incomparable|metadata differs/);
});

test("partial matrix must be explicitly opted into and remains preliminary", () => {
  const { manifest, load } = matrix({ full: false });
  assert.throws(() => analyzeNativeAbMatrix(manifest, load), /incomplete 12-scenario matrix/);
  const result = analyzeNativeAbMatrix(manifest, load, { allowPartial: true });
  assert.equal(result.coverage.completed, 1);
  assert.equal(result.coverage.missing.length, 11);
  assert.equal(result.status, "preliminary_incomplete");
});

test("historical #298 speed is missing: explicit manual verification required", () => {
  const { manifest, files, load } = matrix({ full: false });
  const entry = manifest.scenarios[0];
  files.set(entry.baseline, triple({ residents: 200, speed: null }));
  delete entry.baselineSpeedConfirmed;
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /baseline speed absent/);
  entry.baselineSpeedConfirmed = true;
  const result = analyzeNativeAbMatrix(manifest, load, { allowPartial: true });
  assert.equal(result.scenarios[0].speedConfirmedManually, true);
  files.set(entry.candidate, triple({ residents: 200, speed: null }));
  delete entry.candidateSpeedConfirmed;
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /candidate speed absent/);
});

test("wrong population, speed, platform, scene, terrain or capture duration fail closed", () => {
  const { manifest, files, load } = matrix({ full: false });
  const entry = manifest.scenarios[0];
  for (const changed of [
    { residents: 100 }, { speed: 2 }, { platform: "ios" },
    { scene: "Marker animati" }, { terrain: 200 }, { duration: 9 }
  ]) {
    files.set(entry.candidate, triple({ residents: 200, speed: 1, ...changed }));
    assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
      /Incomparable|metadata differs/);
  }
});

test("same device attestation, duplicate scenarios and reused report files are rejected", () => {
  const { manifest, load } = matrix({ full: false });
  manifest.samePhysicalDeviceConfirmed = false;
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /samePhysicalDeviceConfirmed/);
  manifest.samePhysicalDeviceConfirmed = true;
  manifest.scenarios.push({ ...manifest.scenarios[0] });
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /duplicate scenario/);
  manifest.scenarios[1] = {
    ...manifest.scenarios[0], residents: 100, baseline: manifest.scenarios[0].baseline
  };
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /reused across scenarios/);
});

test("at least three independent captures per side and 100 JS samples per capture", () => {
  const { manifest, files, load } = matrix({ full: false });
  const entry = manifest.scenarios[0];
  files.set(entry.baseline, report({ residents: 200 }));
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /at least three/);
  files.set(entry.baseline, triple({ residents: 200, samples: 90 }));
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }), /fewer than 100/);
});

test("CLI reads local manifest and reports, refuses incomplete matrix without explicit flag", () => {
  const { manifest, files } = matrix({ full: false });
  const dir = mkdtempSync(join(tmpdir(), "mk-native-ab-matrix-"));
  try {
    writeFileSync(join(dir, "matrix.json"), JSON.stringify(manifest));
    for (const [name, content] of files) writeFileSync(join(dir, name), content);
    const script = resolve("scripts/compare-native-ab-matrix.mjs");
    const args = ["--manifest", join(dir, "matrix.json"), "--json"];
    const incomplete = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(incomplete.status, 1);
    assert.match(incomplete.stderr, /incomplete 12-scenario matrix/);
    const valid = spawnSync(process.execPath, [script, ...args, "--allow-partial"], { encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).coverage.completed, 1);
    assert.ok(!valid.stdout.includes("FPS GPU improvement"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("matrix refuses absolute, aliased and traversal report names before loading", () => {
  const { manifest, load } = matrix({full:false});
  const entry = manifest.scenarios[0];
  for (const name of [
    "../outside.txt", "./before.txt", "a//before.txt", "a/../before.txt",
    "/tmp/outside.txt", "C:\\\\outside.txt", "a\\\\before.txt", "bad\nfile.txt"
  ]) {
    entry.baseline = name;
    assert.throws(() => analyzeNativeAbMatrix(manifest, load, {allowPartial:true}),
      /two distinct local report files/);
  }
});

test("CLI refuses symlink escape outside manifest directory", () => {
  const { manifest, files } = matrix({full:false});
  const root = mkdtempSync(join(tmpdir(), "mk-native-ab-escape-"));
  const inside = join(root, "inside");
  try {
    mkdirSync(inside);
    const entry = manifest.scenarios[0];
    writeFileSync(join(root, "outside.txt"), files.get(entry.baseline));
    symlinkSync(join(root, "outside.txt"), join(inside, entry.baseline));
    writeFileSync(join(inside, entry.candidate), files.get(entry.candidate));
    writeFileSync(join(inside, "matrix.json"), JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [
      resolve("scripts/compare-native-ab-matrix.mjs"),
      "--manifest", join(inside, "matrix.json"), "--allow-partial"
    ], {encoding:"utf8"});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /report path escapes manifest directory/);
  } finally {
    rmSync(root, {recursive:true, force:true});
  }
});


test("matrix rejects 10-second reports with only 2 seconds of observed RAF or inflated coverage", () => {
  const { manifest, files, load } = matrix({ full: false });
  const entry = manifest.scenarios[0];
  for (const samples of [120, 1200]) {
    files.set(entry.candidate, triple({ residents: 200, samples }));
    assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
      /RAF samples do not cover the declared capture window/);
  }
  files.set(entry.candidate, triple({ residents: 200, samples: 600 }));
  assert.equal(analyzeNativeAbMatrix(manifest, load, { allowPartial: true }).coverage.completed, 1);
});

test("candidate #297 requires real dispatch and heartbeat evidence in every capture", () => {
  const { manifest, files, load } = matrix({ full: false });
  const entry = manifest.scenarios[0];
  const good = files.get(entry.candidate);
  for (const removed of [
    /^Batch RAF JS campionati:.*\n/gm,
    /^Batch RAF JS p95:.*\n/gm,
    /^Ritardo loop JS campioni:.*\n/gm,
    /^Ritardo loop JS p95:.*\n/gm
  ]) {
    files.set(entry.candidate, good.replace(removed, ""));
    assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
      /candidate #297 missing required JS dispatch\/event-loop probe evidence/);
  }
  files.set(entry.candidate, good.replaceAll("Ritardo loop JS campioni: 20", "Ritardo loop JS campioni: 0"));
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
    /candidate #297 missing required/);
  files.set(entry.candidate, good.replaceAll("Batch RAF JS campionati: 100", "Batch RAF JS campionati: 0"));
  assert.throws(() => analyzeNativeAbMatrix(manifest, load, { allowPartial: true }),
    /candidate #297 missing required/);
});

test("stationary 200-sprite scene allows zero RAF dispatches but still requires heartbeat", () => {
  const { manifest, files, load } = matrix({ full: false });
  const stationary = "Sprite abitanti reali fermi";
  manifest.scene = stationary;
  for (const [name, value] of files) {
    files.set(name, value.replaceAll(SCENE, stationary)
      .replaceAll("Batch RAF JS campionati: 100", "Batch RAF JS campionati: 0"));
  }
  assert.equal(analyzeNativeAbMatrix(manifest, load, { allowPartial: true }).coverage.completed, 1);
});
