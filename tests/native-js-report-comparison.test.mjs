import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseNativeJsReports,
  compareNativeJsReports
} from "../scripts/compare-native-js-reports.mjs";

function report(options = {}) {
  const {
    platform = "android", scene = "Marker animati", residents = 200,
    terrain = 200, duration = 10, samples = 600, mean = 16,
    p95 = 21, over50 = 3, speed = null,
    rafBatch = null, timerBatch = null, lag = null, touch = null
  } = options;
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    "Piattaforma: " + platform,
    "Scena: " + scene,
    "Elementi: " + residents,
    ...(terrain === null ? [] : ["Celle terreno: " + terrain]),
    ...(speed === null ? [] : ["Velocità simulazione: " + speed + "x"]),
    "Durata: " + duration + " s",
    "Campioni: " + samples,
    "FPS JS medio: " + (1000 / mean).toFixed(1),
    "Frame medio: " + mean.toFixed(1) + " ms",
    "p95: " + p95.toFixed(1) + " ms",
    "Frame oltre 33 ms: 6",
    "Frame oltre 50 ms: " + over50,
    ...(rafBatch === null ? [] : ["Batch RAF JS p95: " + rafBatch.toFixed(2) + " ms"]),
    ...(timerBatch === null ? [] : ["Batch timer JS p95: " + timerBatch.toFixed(2) + " ms"]),
    ...(lag === null ? [] : ["Ritardo loop JS p95: " + lag.toFixed(2) + " ms"]),
    ...(touch === null ? [] : ["Gestore tocchi JS p95: " + touch.toFixed(2) + " ms"]),
    "Nota: non equivale a FPS del rendering o misura IA completa."
  ].join("\n");
}

const collect = (cases) => cases.map(r => "\n\n" + report(r)).join("\n---\n");

test("parser extracts three real-format 10-second reports and ignores explanatory prose", () => {
  const a = collect([{ p95: 16, speed: 1 }, { p95: 18, speed: 1 }, { p95: 20, speed: 1 }]);
  const found = parseNativeJsReports("Confronto interno\n" + a);
  assert.equal(found.length, 3);
  assert.deepEqual(found.map(x => x.metrics.frameP95Ms), [16, 18, 20]);
  assert.deepEqual(found.map(x => x.timeScale), [1, 1, 1]);
  assert.equal(found[0].metrics.framesOver50Pct, 0.5);
  assert.equal(found[0].terrainCells, 200);
});

test("median A/B with three replicates reports a review flag without claiming device FPS", () => {
  const before = collect([{p95:20,mean:16,speed:2}, {p95:22,mean:17,speed:2}, {p95:21,mean:17,speed:2}]);
  const after = collect([{p95:26,mean:16,speed:2}, {p95:27,mean:17,speed:2}, {p95:25,mean:16,speed:2}]);
  const result = compareNativeJsReports(before, after);
  assert.equal(result.scenario.speed, 2);
  assert.deepEqual(result.runs, { baseline: 3, candidate: 3 });
  const p95 = result.metrics.find(m => m.key === "frameP95Ms");
  assert.equal(p95.baselineMedian, 21);
  assert.equal(p95.candidateMedian, 26);
  assert.equal(p95.review, true);
  assert.ok(result.scope.includes("NOT native UI/GPU FPS"));
  assert.ok(result.conclusion.includes("advisory_only"));
  assert.ok(result.warnings.some(w => w.includes("Device identity")));
});

test("baseline #295 has fewer probes and no speed; missing metrics never become zero", () => {
  const before = collect([{p95:23}, {p95:24}, {p95:22}]);
  const after = collect([
    {p95:20,speed:1,rafBatch:7,timerBatch:3,lag:9},
    {p95:21,speed:1,rafBatch:8,timerBatch:4,lag:11},
    {p95:19,speed:1,rafBatch:7,timerBatch:5,lag:10}
  ]);
  const result = compareNativeJsReports(before, after);
  assert.equal(result.scenario.speed, 1);
  assert.ok(result.warnings.some(w => w.includes("Simulation speed")));
  assert.deepEqual(result.metrics.map(m => m.key), ["frameP95Ms", "frameMeanMs", "framesOver50Pct"]);
});

test("reject mismatched platform, population, terrain, duration or scene instead of fabricating gains", () => {
  const baseline = report({speed:1});
  for (const changed of [
    {platform:"ios"}, {residents:100}, {terrain:500}, {duration:20}, {scene:"Marker fermi"}
  ]) {
    assert.throws(() => compareNativeJsReports(baseline, report({...changed,speed:1})), /Incomparable reports/);
  }
});

test("reject speed changes, or several speeds in either group", () => {
  assert.throws(() => compareNativeJsReports(report({speed:1}), report({speed:4})), /Incomparable simulation speeds/);
  assert.throws(() => compareNativeJsReports(
    collect([{speed:1}, {speed:4}]), report({speed:1})
  ), /mixed\/unknown simulation speeds/);
  assert.throws(() => compareNativeJsReports(
    collect([{speed:1}, {speed:null}]), report({speed:1})
  ), /mixed\/unknown simulation speeds/);
});

test("invalid or incomplete metadata never produces a misleading comparison", () => {
  assert.throws(() => parseNativeJsReports("not a report"), /No MyKingdom/);
  assert.throws(() => parseNativeJsReports(""), /nonempty/);
  assert.throws(() => parseNativeJsReports(report().replace("Piattaforma: android", "Piattaforma: web")), /Invalid metadata/);
  assert.throws(() => parseNativeJsReports(report().replace("Elementi: 200", "Elementi: -4")), /Invalid metric/);
  assert.throws(() => parseNativeJsReports(report().replace("Campioni: 600", "Campioni: 1")), /Invalid JS frame counts/);
  assert.throws(() => parseNativeJsReports(report().replace("p95: 21.0 ms", "p95: not available")), /nonnumeric/);
  assert.throws(() => parseNativeJsReports(report({speed:1}).replace("Velocità simulazione: 1x", "Velocità simulazione: 3x")), /Invalid metadata/);
  assert.throws(() => parseNativeJsReports("x".repeat(5_000_001)), /5 MB/);
});

test("one low-sample run is preliminary, not a fabricated valid hardware benchmark", () => {
  const before = report({samples:40,over50:5,speed:0});
  const after = report({samples:45,over50:3,speed:0,p95:20});
  const result = compareNativeJsReports(before, after);
  assert.ok(result.warnings.some(w => w.includes("at least three")));
  assert.ok(result.warnings.some(w => w.includes("fewer than 100")));
  assert.equal(result.scenario.speed, 0);
});

test("the absolute change threshold handles near-zero baseline metrics without Infinity", () => {
  const before = collect([{lag:0,speed:4},{lag:0,speed:4},{lag:0,speed:4}]);
  const after = collect([{lag:6,speed:4},{lag:6,speed:4},{lag:6,speed:4}]);
  const comparison = compareNativeJsReports(before, after);
  const metric = comparison.metrics.find(m => m.key === "eventLoopLagP95Ms");
  assert.equal(metric.changePercent, null);
  assert.equal(metric.review, true);
});

test("sizable run-to-run variability is flagged and never suppressed by the median", () => {
  const before = collect([{p95:13,speed:2},{p95:25,speed:2},{p95:18,speed:2}]);
  const after = collect([{p95:19,speed:2},{p95:20,speed:2},{p95:21,speed:2}]);
  const result = compareNativeJsReports(before, after);
  assert.ok(result.warnings.some(w => w.includes("variability")));
});

test("standalone CLI reads two local files, emits JSON and fails closed on mismatches", () => {
  const tmp = mkdtempSync(join(tmpdir(), "mykingdom-js-compare-"));
  try {
    const before = join(tmp, "before.txt");
    const after = join(tmp, "after.txt");
    writeFileSync(before, collect([{speed:1},{speed:1},{speed:1}]));
    writeFileSync(after, collect([{speed:1,p95:19},{speed:1,p95:20},{speed:1,p95:21}]));
    const script = resolve("scripts/compare-native-js-reports.mjs");
    const valid = spawnSync(process.execPath, [script, "--baseline", before, "--candidate", after, "--json"], { encoding:"utf8" });
    assert.equal(valid.status, 0, valid.stderr);
    const parsed = JSON.parse(valid.stdout);
    assert.equal(parsed.runs.candidate, 3);
    assert.equal(parsed.scenario.residents, 200);
    writeFileSync(after, report({platform:"ios"}));
    const mismatch = spawnSync(process.execPath, [script, "--baseline", before, "--candidate", after], { encoding:"utf8" });
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /Incomparable/);
  } finally {
    rmSync(tmp, { recursive:true, force:true });
  }
});

test("capture parser is robust to missing optional terrain and no optional probe values", () => {
  const sample = report({terrain:null,speed:null,touch:null});
  const [parsed] = parseNativeJsReports(sample);
  assert.equal(parsed.terrainCells, null);
  assert.equal(parsed.timeScale, null);
  assert.equal(parsed.metrics.touchCallbackP95Ms, null);
});

test("reject malformed units, numeric prefixes, duplicated fields and inconsistent counts", () => {
  const valid = report({speed:2});
  for (const corrupted of [
    valid.replace("Velocità simulazione: 2x", "Velocità simulazione: 2x4"),
    valid.replace("Campioni: 600", "Campioni: 600garbage"),
    valid.replace("p95: 21.0 ms", "p95: 21.0 seconds"),
    valid.replace("Durata: 10 s", "Durata: 10 ms"),
    valid.replace("Frame oltre 50 ms: 3", "Frame oltre 50 ms: 3.5"),
    valid.replace("Frame oltre 50 ms: 3", "Frame oltre 50 ms: 7"),
    valid.replace("FPS JS medio: 62.5", "FPS JS medio: 200"),
    valid + "\np95: 999 ms",
    valid + "\nPiattaforma: ios"
  ]) {
    assert.throws(() => parseNativeJsReports(corrupted),
      /nonnumeric|Invalid metric|Invalid JS frame counts|Duplicate report field/);
  }
  assert.equal(parseNativeJsReports(valid)[0].timeScale, 2);
});
