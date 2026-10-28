import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentDispatchProfiler } from "../src/performance/nativeResidentDispatchProfiler.ts";

test("opt-in capture: no clock reads or samples outside the measurement window", () => {
  let time = 0;
  let reads = 0;
  const p = new NativeResidentDispatchProfiler(() => { reads++; return time; });
  assert.equal(p.begin("frame"), null);
  assert.equal(reads, 0);
  const token = p.start();
  const f = p.begin("frame");
  time += 6;
  p.end("frame", f);
  const t = p.begin("timer");
  time += 18;
  p.end("timer", t);
  const report = p.finish(token)!;
  assert.equal(report.frame.samples, 1);
  assert.equal(report.frame.totalMs, 6);
  assert.equal(report.timer.samples, 1);
  assert.equal(report.timer.over16Ms, 1);
  assert.equal(report.timer.maxMs, 18);
  assert.equal(p.begin("frame"), null);
  assert.equal(reads, 4);
  assert.equal(p.finish(token), null);
});

test("p95, mean, threshold counts and bounded ring buffer are deterministic", () => {
  let now = 0;
  const p = new NativeResidentDispatchProfiler(() => now, 20);
  const token = p.start();
  for (let i = 1; i <= 100; i++) {
    const ticket = p.begin("frame");
    now += i;
    p.end("frame", ticket);
  }
  const s = p.finish(token)!.frame;
  assert.equal(s.samples, 20);
  assert.equal(s.observed, 100);
  assert.equal(s.dropped, 80);
  assert.equal(s.totalMs, 1810);
  assert.equal(s.meanMs, 90.5);
  assert.equal(s.p95Ms, 99);
  assert.equal(s.maxMs, 100);
  assert.equal(s.over8Ms, 20);
  assert.equal(s.over16Ms, 20);
});

test("cancel and replacement cannot include late dispatches from old captures", () => {
  let now = 0;
  const p = new NativeResidentDispatchProfiler(() => now);
  const old = p.start();
  const stale = p.begin("frame");
  p.cancel(old);
  const current = p.start();
  now = 1000;
  p.end("frame", stale);
  p.cancel(old); // must not cancel the new capture
  const good = p.begin("frame");
  now += 3;
  p.end("frame", good);
  assert.equal(p.finish(old), null);
  assert.equal(p.finish(current)!.frame.totalMs, 3);
});

test("invalid clocks, negative durations, empty captures and invalid capacities are safe", () => {
  assert.throws(() => new NativeResidentDispatchProfiler(() => 0, 0));
  assert.throws(() => new NativeResidentDispatchProfiler(() => 0, 1.2));
  let now = Number.NaN;
  const p = new NativeResidentDispatchProfiler(() => now);
  const token = p.start();
  assert.equal(p.begin("timer"), null);
  now = 20;
  const ticket = p.begin("timer");
  now = 10;
  p.end("timer", ticket);
  const result = p.finish(token)!;
  assert.deepEqual(result.timer, {
    samples: 0, observed: 0, dropped: 0, totalMs: 0,
    meanMs: 0, p95Ms: 0, maxMs: 0, over8Ms: 0, over16Ms: 0
  });
});

test("200 residents across 240 frame batches and 200 timer callbacks are aggregates only", () => {
  let now = 0;
  const p = new NativeResidentDispatchProfiler(() => now);
  const token = p.start();
  for (let frame = 0; frame < 240; frame++) {
    const t = p.begin("frame");
    // Simulates a batch containing 200 logical resident updates.
    now += 5;
    p.end("frame", t);
  }
  for (let batch = 0; batch < 7; batch++) {
    const t = p.begin("timer");
    now += 2;
    p.end("timer", t);
  }
  const report = p.finish(token)!;
  assert.equal(report.frame.samples, 240);
  assert.equal(report.frame.totalMs, 1200);
  assert.equal(report.timer.samples, 7);
  assert.equal(report.timer.totalMs, 14);
  assert.equal(JSON.stringify(report).includes("residentId"), false);
  assert.equal(JSON.stringify(report).includes("cellIndex"), false);
});
