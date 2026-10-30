import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentEventLoopProbe } from "../src/performance/nativeResidentEventLoopProbe.ts";
import {
  NativeResidentDispatchProfiler, startNativeResidentDispatchCapture,
  finishNativeResidentDispatchCapture
} from "../src/performance/nativeResidentDispatchProfiler.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";

function fakeProbe(capacity = 256, intervalMs = 50) {
  let now = 0;
  let id = 1;
  const alarms = new Map<number, { due: number; fn: () => void }>();
  const probe = new NativeResidentEventLoopProbe(
    () => now,
    (fn, delay) => {
      const next = id++;
      alarms.set(next, { due: now + delay, fn });
      return next;
    },
    id => { alarms.delete(id); },
    intervalMs, capacity
  );
  return {
    probe, alarms,
    get now() { return now; },
    setNow(time: number) { now = time; },
    fireAt(time: number) {
      assert.equal(alarms.size, 1, "only one JS heartbeat timer");
      const [key, alarm] = alarms.entries().next().value!;
      assert.ok(time >= alarm.due);
      alarms.delete(key);
      now = time;
      alarm.fn();
    }
  };
}

test("opt-in JS event-loop probe has zero idle timers and records delayed scheduling", () => {
  const f = fakeProbe();
  assert.equal(f.alarms.size, 0);
  const token = f.probe.start();
  assert.equal(f.alarms.size, 1);
  f.fireAt(50); // no lag
  f.fireAt(108); // +8ms
  f.fireAt(194); // +36ms
  f.fireAt(310); // +66ms
  const r = f.probe.finish(token)!;
  assert.deepEqual(r, {
    samples: 4, observed: 4, dropped: 0,
    meanMs: 27.5, p95Ms: 66, maxMs: 66,
    over16Ms: 2, over50Ms: 1
  });
  assert.equal(f.alarms.size, 0);
  assert.equal(f.probe.finish(token), null);
});

test("cancel/restart and stale platform callbacks cannot contaminate new captures", () => {
  const f = fakeProbe();
  const old = f.probe.start();
  const stale = f.alarms.values().next().value!.fn;
  f.probe.cancel(old);
  assert.equal(f.alarms.size, 0);
  const current = f.probe.start();
  stale(); // native bridge may deliver an already-canceled callback
  assert.equal(f.alarms.size, 1);
  f.probe.cancel(old); // old token must not cancel the new capture
  f.fireAt(50);
  assert.equal(f.probe.finish(current)!.samples, 1);
  assert.equal(f.probe.finish(old), null);
});

test("10,000 heartbeats stay in a bounded ring without catch-up bursts", () => {
  const f = fakeProbe(64);
  const token = f.probe.start();
  for (let i = 0; i < 10_000; i++) {
    // Alternate on-time delivery and a delayed event loop.
    const due = f.alarms.values().next().value!.due;
    f.fireAt(due + (i % 4) * 20);
    assert.equal(f.alarms.size, 1);
  }
  const r = f.probe.finish(token)!;
  assert.equal(r.samples, 64);
  assert.equal(r.observed, 10_000);
  assert.equal(r.dropped, 9936);
  assert.equal(r.meanMs, 30);
  assert.equal(r.p95Ms, 60);
  assert.equal(r.maxMs, 60);
  assert.equal(r.over16Ms, 48);
  assert.equal(r.over50Ms, 16);
});

test("invalid clocks, parameters and regression do not produce false lag or spin", () => {
  assert.throws(() => fakeProbe(0), /parameters/);
  assert.throws(() => fakeProbe(256, 0), /parameters/);
  assert.throws(() => fakeProbe(256, Number.NaN), /parameters/);
  const f = fakeProbe();
  const token = f.probe.start();
  const alarm = f.alarms.values().next().value!;
  f.setNow(-5);
  alarm.fn(); // monotonic clock regression: skip rather than negative lag
  assert.equal(f.probe.finish(token)!.samples, 0);
  const broken = new NativeResidentEventLoopProbe(() => Number.NaN);
  assert.throws(() => broken.start(), /clock/);
});

test("200 native resident touch handlers and pause transitions report JS cost only", () => {
  let now = 0;
  let reads = 0;
  const p = new NativeResidentDispatchProfiler(() => { reads++; return now; }, 256);
  assert.equal(p.begin("touch"), null);
  assert.equal(reads, 0, "zero clock overhead when not measuring");
  const token = p.start();
  for (let i = 0; i < 200; i++) {
    const ticket = p.begin("touch");
    now += i % 5;
    p.end("touch", ticket);
  }
  const lifecycle = p.begin("lifecycle");
  now += 20;
  p.end("lifecycle", lifecycle);
  const r = p.finish(token)!;
  assert.equal(r.touch.samples, 200);
  assert.equal(r.touch.meanMs, 2);
  assert.equal(r.touch.p95Ms, 4);
  assert.equal(r.touch.maxMs, 4);
  assert.equal(r.lifecycle.maxMs, 20);
  assert.equal(r.lifecycle.over16Ms, 1);
  assert.equal(r.frame.samples, 0);
  assert.equal(r.timer.samples, 0);
  assert.equal(reads, 402);
});

test("native frame-bus lifecycle notifications are included in opt-in profiler", () => {
  const frames = new Map<number, (timestamp: number) => void>();
  let id = 0;
  const bus = new NativeResidentFrameBus(
    callback => { frames.set(++id, callback); return id; },
    id => { frames.delete(id); }
  );
  const token = startNativeResidentDispatchCapture();
  for (let i = 0; i < 200; i++) bus.subscribeActivity(() => {});
  for (let i = 0; i < 20; i++) {
    bus.setActive(false);
    bus.setActive(true);
  }
  const r = finishNativeResidentDispatchCapture(token)!;
  assert.equal(r.lifecycle.samples, 40);
  assert.equal(r.touch.samples, 0);
  assert.equal(bus.snapshot().activityListeners, 200);
});

test("native 10-second share report distinguishes JS lag, handler cost and physical touch latency", () => {
  const session = new NativeMeasurementSession(0, 10_000);
  session.record(16, 16);
  const completed = session.record(10_000, 16)!;
  let now = 0;
  const p = new NativeResidentDispatchProfiler(() => now);
  const token = p.start();
  const tap = p.begin("touch");
  now += 5;
  p.end("touch", tap);
  const transition = p.begin("lifecycle");
  now += 9;
  p.end("lifecycle", transition);
  const report = formatNativeMeasurement(
    completed, { platform: "android", label: "200 abitanti", residents: 200 },
    undefined, undefined, undefined, p.finish(token)!,
    { samples: 3, observed: 3, dropped: 0, meanMs: 8, p95Ms: 20,
      maxMs: 20, over16Ms: 1, over50Ms: 0 }
  );
  assert.match(report, /Gestore tocchi JS p95: 5\.00 ms/);
  assert.match(report, /Transizioni pausa\/background JS p95: 9\.00 ms/);
  assert.match(report, /Ritardo loop JS p95: 20\.00 ms/);
  assert.match(report, /NON latenza touch o frame UI\/GPU/);
  assert.ok(!report.includes("residentId"));
  assert.ok(!report.includes("cellIndex"));
});
