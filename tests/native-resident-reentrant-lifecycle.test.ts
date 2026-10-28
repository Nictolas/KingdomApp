import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import {
  startNativeResidentDispatchCapture,
  finishNativeResidentDispatchCapture,
  cancelNativeResidentDispatchCapture
} from "../src/performance/nativeResidentDispatchProfiler.ts";

function environment() {
  let wall = 0;
  let id = 0;
  const frames = new Map<number, (timestamp: number) => void>();
  const alarms = new Map<number, { due: number; callback: () => void }>();
  const bus = new NativeResidentFrameBus(
    cb => { const key = ++id; frames.set(key, cb); return key; },
    key => { frames.delete(key); }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (cb, delay) => {
      const key = ++id;
      alarms.set(key, { due: wall + delay, callback: cb });
      return key;
    },
    key => { alarms.delete(key); },
    32
  );
  return {
    bus, queue, frames, alarms,
    setWall(value: number) { assert.ok(value >= wall); wall = value; },
    frame() {
      assert.equal(frames.size, 1);
      const [key, cb] = frames.entries().next().value!;
      frames.delete(key);
      cb(wall);
    },
    timer() {
      assert.equal(alarms.size, 1);
      const [key, alarm] = alarms.entries().next().value!;
      assert.ok(alarm.due <= wall);
      alarms.delete(key);
      alarm.callback();
    }
  };
}

test("200 persistent RAF residents cannot run in the same frame after a synchronous pause/resume", () => {
  const f = environment();
  const order: number[] = [];
  let toggled = false;
  const ids = Array.from({ length: 200 }, (_, i) => f.bus.subscribeFrame((_ts, rebase) => {
    if (i === 0 && !toggled) {
      toggled = true;
      order.push(i);
      f.bus.setActive(false);
      f.bus.setActive(true);
      return;
    }
    assert.equal(rebase, true, "the next frame must rebase after a reentrant lifecycle transition");
    order.push(i);
  }));
  f.setWall(16);
  f.frame();
  assert.deepEqual(order, [0], "the old dispatch must stop even if the game is active again");
  assert.equal(f.frames.size, 1);
  f.setWall(50_000);
  f.frame();
  assert.equal(order.length, 201);
  assert.deepEqual(order.slice(1), Array.from({ length: 200 }, (_, i) => i));
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.frames.size, 0);
});

test("200 one-shot RAF callbacks resume once, in original order, after reentrant pause", () => {
  const f = environment();
  const order: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.bus.request((_time, rebase) => {
      order.push(i);
      if (i === 0) {
        assert.equal(rebase, false);
        f.bus.setActive(false);
        f.bus.setActive(true);
      } else {
        assert.equal(rebase, true);
      }
    });
  }
  f.setWall(16);
  f.frame();
  assert.deepEqual(order, [0]);
  assert.equal(f.bus.snapshot().queued, 199);
  f.setWall(20_000);
  f.frame();
  assert.deepEqual(order, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.frames.size, 0);
});

test("200 due collision retries stop after reentrant pause and drain in 32-callback turns", () => {
  const f = environment();
  const order: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.queue.schedule(() => {
      order.push(i);
      if (i === 0) {
        f.queue.setActive(false);
        f.queue.setActive(true);
      }
    }, 900);
  }
  f.setWall(900);
  f.timer();
  assert.deepEqual(order, [0]);
  assert.equal(f.queue.snapshot().pending, 199);
  assert.equal(f.alarms.size, 1);
  let subsequentWakeups = 0;
  while (f.alarms.size) {
    f.timer();
    if (++subsequentWakeups > 8) throw new Error("cooperative timer backlog did not drain");
  }
  assert.equal(subsequentWakeups, 7);
  assert.deepEqual(order, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.queue.snapshot().logicalCallbacks, 200);
});

test("nested lifecycle listeners cannot deliver an obsolete state to a later resident", () => {
  const f = environment();
  const states: string[] = [];
  f.bus.subscribeActivity(active => {
    states.push("first-" + active);
    if (!active) f.bus.setActive(true);
  });
  f.bus.subscribeActivity(active => states.push("second-" + active));
  f.bus.setActive(false);
  assert.deepEqual(states, ["first-false", "first-true", "second-true"]);
  assert.equal(f.bus.snapshot().active, true);
});

test("200 resident integration: app gate suspends RAF and timers together without duplicate work", () => {
  const f = environment();
  const gate = new NativeResidentActivityGate(true, false, active => {
    f.bus.setActive(active);
    f.queue.setActive(active);
  });
  const seenFrames = Array<number>(200).fill(0);
  const seenTimers = Array<number>(200).fill(0);
  let transitioned = false;
  const ids = Array.from({ length: 200 }, (_, i) => f.bus.subscribeFrame(() => {
    seenFrames[i]!++;
    if (i === 0 && !transitioned) {
      transitioned = true;
      gate.setForeground(false);
      gate.setForeground(true);
    }
  }));
  for (let i = 0; i < 200; i++) f.queue.schedule(() => { seenTimers[i]!++; }, 900);
  f.setWall(900);
  f.frame();
  assert.equal(seenFrames.reduce((a, b) => a + b, 0), 1);
  assert.equal(f.frames.size, 1);
  assert.equal(f.alarms.size, 1);
  f.frame();
  assert.equal(seenFrames.reduce((a, b) => a + b, 0), 201);
  while (f.alarms.size) f.timer();
  assert.ok(seenTimers.every(n => n === 1));
  assert.ok(seenFrames.every((n, i) => n === (i === 0 ? 2 : 1)));
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.frames.size, 0);
});

test("actual frame/timer scheduler instrumentation is opt-in and counts one batch, not 200 residents", () => {
  const f = environment();
  const token = startNativeResidentDispatchCapture();
  for (let i = 0; i < 200; i++) {
    f.bus.request(() => {});
    f.queue.schedule(() => {}, 900);
  }
  f.setWall(900);
  f.frame();
  for (let i = 0; i < 7; i++) f.timer();
  const report = finishNativeResidentDispatchCapture(token)!;
  assert.equal(report.frame.samples, 1);
  assert.equal(report.timer.samples, 7);
  assert.ok(report.frame.meanMs >= 0);
  assert.ok(report.timer.maxMs >= 0);
  assert.equal(report.frame.dropped, 0);
  assert.equal(report.timer.dropped, 0);
  assert.equal(finishNativeResidentDispatchCapture(token), null);
  const second = startNativeResidentDispatchCapture();
  cancelNativeResidentDispatchCapture(second);
  assert.equal(finishNativeResidentDispatchCapture(second), null);
});

test("240-frame reentrant stress: 200 residents, 20 nested pauses, 40 unmounts and respawns", () => {
  const f = environment();
  const alive = Array<boolean>(200).fill(true);
  const seen = Array<number>(200).fill(0);
  const handles = Array<number>(200).fill(0);
  let currentFrame = 0;
  let lastTransition = -1;
  let expected = 0;
  const subscribe = (i: number) => {
    handles[i] = f.bus.subscribeFrame((_timestamp, rebase) => {
      assert.equal(alive[i], true, "unmounted resident callback must not execute");
      if (lastTransition === currentFrame - 1) {
        assert.equal(rebase, true, "every subscriber must rebase on the frame after a nested pause");
      }
      seen[i]!++;
      if (i === 0 && currentFrame % 12 === 0) {
        lastTransition = currentFrame;
        f.bus.setActive(false);
        f.bus.setActive(true);
      }
    });
  };
  for (let i = 0; i < 200; i++) subscribe(i);
  for (let frame = 1; frame <= 240; frame++) {
    currentFrame = frame;
    if (frame === 101) {
      for (let i = 160; i < 200; i++) {
        alive[i] = false;
        f.bus.cancel(handles[i]!);
      }
    }
    if (frame === 151) {
      for (let i = 160; i < 200; i++) {
        alive[i] = true;
        subscribe(i);
      }
    }
    const active = alive.filter(Boolean).length;
    expected += frame % 12 === 0 ? 1 : active;
    f.setWall(frame * 16);
    f.frame();
    assert.equal(seen.reduce((sum, count) => sum + count, 0), expected);
    assert.equal(f.bus.snapshot().continuousSubscribers, active);
    assert.equal(f.frames.size, 1, "at most one platform RAF while moving");
  }
  assert.equal(lastTransition, 240);
  assert.ok(seen.every(n => n > 0));
  handles.forEach(id => f.bus.cancel(id));
  assert.equal(f.frames.size, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
});
