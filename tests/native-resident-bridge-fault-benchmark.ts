/**
 * Synthetic JS-only fault-recovery workload for the native resident schedulers.
 * Not a Hermes, GPU/UI, battery, touch, Android or iPhone measurement.
 * No absolute CPU timing threshold: shared CI hosts are not repeatable.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { applyNativeResidentSchedulerActivity } from "../src/performance/nativeResidentSchedulerActivity.ts";

function run(residents: number, cycles: number, inject: boolean) {
  let frames = 0, timers = 0, failures = 0, platformFrames = 0, platformAlarms = 0;
  const started = performance.now();
  for (let cycle = 0; cycle < cycles; cycle++) {
    let now = 0, next = 0;
    let failRaf = inject && cycle % 5 === 0;
    let failAlarm = inject && cycle % 7 === 0;
    let failRafCancel = inject && cycle % 11 === 0;
    let failTimerCancel = inject && cycle % 13 === 0;
    const raf = new Map<number, (time: number) => void>();
    const alarms = new Map<number, { due: number; cb: () => void }>();
    const bus = new NativeResidentFrameBus(
      cb => {
        if (failRaf) { failRaf = false; throw new Error("synthetic request RAF"); }
        platformFrames++;
        const id = ++next; raf.set(id, cb); return id;
      },
      id => {
        raf.delete(id);
        if (failRafCancel) { failRafCancel = false; throw new Error("synthetic cancel RAF"); }
      }
    );
    const queue = new NativeResidentTimerQueue(
      () => now,
      (cb, delay) => {
        if (failAlarm) { failAlarm = false; throw new Error("synthetic setTimeout"); }
        platformAlarms++;
        const id = ++next; alarms.set(id, { due: now + delay, cb }); return id;
      },
      id => {
        alarms.delete(id);
        if (failTimerCancel) { failTimerCancel = false; throw new Error("synthetic clearTimeout"); }
      },
      32, 6
    );
    const on = (active: boolean) => applyNativeResidentSchedulerActivity(
      active, value => queue.setActive(value), value => bus.setActive(value)
    );
    const frameIds: number[] = [];
    const timerIds: number[] = [];
    for (let resident = 0; resident < residents; resident++) {
      try {
        frameIds.push(bus.subscribeFrame(() => { frames++; }));
      } catch {
        failures++;
        frameIds.push(bus.subscribeFrame(() => { frames++; }));
      }
      try {
        timerIds.push(queue.schedule(() => { timers++; }, 900));
      } catch {
        failures++;
        timerIds.push(queue.schedule(() => { timers++; }, 900));
      }
    }
    assert.equal(raf.size, 1);
    assert.equal(alarms.size, 1);
    const [frameId, callback] = raf.entries().next().value!;
    raf.delete(frameId);
    now = 16;
    callback(now);
    now = 100;
    try { on(false); } catch { failures++; }
    assert.equal(bus.isActive(), false);
    assert.equal(queue.snapshot().active, false);
    assert.equal(raf.size, 0);
    assert.equal(alarms.size, 0);
    now += 50_000; // Background does not advance the virtual timer deadlines.
    on(true);
    assert.equal(raf.size, 1);
    assert.equal(alarms.size, 1);
    const [resumedId, resumedFrame] = raf.entries().next().value!;
    raf.delete(resumedId);
    resumedFrame(now);
    now += 800;
    let turns = 0;
    while (alarms.size) {
      const [alarmId, alarm] = alarms.entries().next().value!;
      assert.ok(alarm.due <= now);
      alarms.delete(alarmId);
      alarm.cb();
      turns++;
      assert.ok(turns <= Math.ceil(residents / 32));
    }
    assert.equal(turns, Math.ceil(residents / 32));
    frameIds.forEach(id => bus.cancel(id));
    timerIds.forEach(id => queue.cancel(id));
    assert.equal(bus.snapshot().queued, 0);
    assert.equal(queue.snapshot().pending, 0);
    assert.equal(raf.size, 0);
    assert.equal(alarms.size, 0);
  }
  const elapsedMs = performance.now() - started;
  assert.equal(frames, cycles * residents * 2);
  assert.equal(timers, cycles * residents);
  return {
    residents, cycles, injectedFaults: inject, handledBridgeFailures: failures,
    logicalFrameCallbacks: frames, logicalTimerCallbacks: timers,
    platformFrameSchedules: platformFrames, platformTimerSchedules: platformAlarms,
    elapsedNodeMs: Number(elapsedMs.toFixed(2)),
    disclaimer: "Synthetic Node JS only; no phone FPS, native touch or GPU measurement"
  };
}

for (const residents of [200, 1000]) {
  for (const injectedFaults of [false, true]) {
    console.log(JSON.stringify(run(residents, 60, injectedFaults)));
  }
}
