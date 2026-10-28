import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";

function fakeScheduler() {
  let nextPlatformId = 1;
  let requested = 0;
  let cancelled = 0;
  const frames = new Map<number, (timestamp: number) => void>();
  const bus = new NativeResidentFrameBus(
    (callback) => {
      const id = nextPlatformId++;
      requested++;
      frames.set(id, callback);
      return id;
    },
    (id) => {
      cancelled++;
      frames.delete(id);
    }
  );
  const tick = (timestamp: number) => {
    assert.equal(frames.size, 1, "exactly one OS RAF must be pending");
    const [[id, callback]] = frames.entries();
    frames.delete(id);
    callback(timestamp);
  };
  return {
    bus, frames, tick,
    get requested() { return requested; },
    get cancelled() { return cancelled; }
  };
}

test("200 simultaneous moving residents share one platform RAF per frame", () => {
  const runner = fakeScheduler();
  const residentCount = 200;
  const totalFrames = 120;
  let callbacks = 0;
  const firstFrameTimestamps: number[] = [];
  for (let resident = 0; resident < residentCount; resident++) {
    let drawn = 0;
    const step = (timestamp: number): void => {
      callbacks++;
      drawn++;
      if (drawn === 1) firstFrameTimestamps.push(timestamp);
      if (drawn < totalFrames) runner.bus.request(step);
    };
    runner.bus.request(step);
  }
  assert.equal(runner.requested, 1);
  for (let frame = 1; frame <= totalFrames; frame++) {
    runner.tick(frame * 16);
    assert.equal(runner.bus.snapshot().dispatchCount, frame);
    assert.equal(runner.requested, Math.min(frame + 1, totalFrames));
  }
  assert.equal(callbacks, residentCount * totalFrames);
  assert.equal(runner.requested, totalFrames, "one OS RAF per frame, not 200");
  assert.ok(firstFrameTimestamps.every((value) => value === 16));
  assert.equal(runner.bus.snapshot().queued, 0);
  assert.equal(runner.frames.size, 0);
});

test("unmounting one resident leaves siblings active, last cancellation stops platform RAF", () => {
  const runner = fakeScheduler();
  const calls: number[] = [];
  const a = runner.bus.request(() => calls.push(1));
  const b = runner.bus.request(() => calls.push(2));
  runner.bus.cancel(a);
  assert.equal(runner.frames.size, 1);
  runner.tick(16);
  assert.deepEqual(calls, [2]);
  assert.equal(runner.bus.snapshot().queued, 0);
  const c = runner.bus.request(() => calls.push(3));
  runner.bus.cancel(c);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.cancelled, 1);
  runner.bus.cancel(b); // harmless after dispatch
});

test("a callback may cancel a sibling already in the current frame batch", () => {
  const runner = fakeScheduler();
  const calls: string[] = [];
  let second = 0;
  runner.bus.request(() => {
    calls.push("first");
    runner.bus.cancel(second);
  });
  second = runner.bus.request(() => calls.push("second"));
  runner.tick(16);
  assert.deepEqual(calls, ["first"]);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("new callbacks registered by a moving resident start next frame, never this one", () => {
  const runner = fakeScheduler();
  const frames: number[] = [];
  runner.bus.request(() => {
    frames.push(1);
    runner.bus.request(() => frames.push(2));
  });
  runner.tick(16);
  assert.deepEqual(frames, [1]);
  assert.equal(runner.requested, 2);
  runner.tick(32);
  assert.deepEqual(frames, [1, 2]);
});

test("a broken resident does not prevent healthy residents from updating", () => {
  const runner = fakeScheduler();
  let healthy = 0;
  runner.bus.request(() => { throw new Error("broken sprite"); });
  runner.bus.request(() => { healthy += 1; });
  assert.throws(() => runner.tick(16), /broken sprite/);
  assert.equal(healthy, 1);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("RAF bus remains idle with no moving residents", () => {
  const runner = fakeScheduler();
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.requested, 0);
  const first = runner.bus.request(() => {});
  runner.bus.cancel(first);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("200 moving residents suspend with zero platform RAF while game is paused", () => {
  const runner = fakeScheduler();
  let calls = 0;
  const resumedSignals: boolean[] = [];
  for (let i = 0; i < 200; i++) {
    const step = (_now: number, resumed: boolean): void => {
      calls++;
      resumedSignals.push(resumed);
      if (calls <= 200) runner.bus.request(step);
    };
    runner.bus.request(step);
  }
  runner.bus.setActive(false);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.cancelled, 1);
  assert.equal(runner.bus.snapshot().queued, 200);
  assert.equal(runner.bus.snapshot().active, false);
  runner.bus.request(() => { calls++; });
  assert.equal(runner.frames.size, 0, "new residents must not create OS RAF during pause");

  runner.bus.setActive(true);
  assert.equal(runner.frames.size, 1);
  runner.tick(60_000);
  assert.equal(calls, 201);
  assert.ok(resumedSignals.every(Boolean), "every resident must rebase its clock on resume");
  assert.equal(runner.bus.snapshot().queued, 200);
  runner.tick(60_016);
  assert.ok(resumedSignals.slice(200).every((flag) => !flag), "only the first frame rebases");
});

test("pause in the middle of a frame postpones the remaining residents", () => {
  const runner = fakeScheduler();
  const calls: string[] = [];
  runner.bus.request(() => {
    calls.push("first");
    runner.bus.setActive(false);
  });
  runner.bus.request((_ts, rebase) => calls.push(rebase ? "second-resumed" : "second-active"));
  runner.tick(16);
  assert.deepEqual(calls, ["first"]);
  assert.equal(runner.bus.snapshot().queued, 1);
  assert.equal(runner.frames.size, 0);
  runner.bus.setActive(true);
  runner.tick(100);
  assert.deepEqual(calls, ["first", "second-resumed"]);
});

test("an obsolete platform RAF cannot accidentally execute a newly scheduled batch", () => {
  const runner = fakeScheduler();
  const calls: string[] = [];
  runner.bus.request(() => calls.push("old"));
  const oldCallback = [...runner.frames.values()][0]!;
  runner.bus.setActive(false);
  runner.bus.setActive(true);
  assert.equal(runner.frames.size, 1);
  oldCallback(999);
  assert.deepEqual(calls, []);
  assert.equal(runner.frames.size, 1);
  runner.tick(1000);
  assert.deepEqual(calls, ["old"]);
});

test("unmounting all residents during a pause leaves no work upon resume", () => {
  const runner = fakeScheduler();
  const ids = Array.from({ length: 200 }, () => runner.bus.request(() => {
    throw new Error("unmounted resident ran");
  }));
  runner.bus.setActive(false);
  ids.forEach((id) => runner.bus.cancel(id));
  assert.equal(runner.bus.snapshot().queued, 0);
  runner.bus.setActive(true);
  assert.equal(runner.frames.size, 0);
});

test("repeated pause/resume notifications are idempotent", () => {
  const runner = fakeScheduler();
  runner.bus.request(() => {});
  runner.bus.setActive(false);
  runner.bus.setActive(false);
  assert.equal(runner.cancelled, 1);
  runner.bus.setActive(true);
  runner.bus.setActive(true);
  assert.equal(runner.requested, 2);
  runner.tick(17);
  assert.equal(runner.frames.size, 0);
});

test("pause keeps a callback scheduled by the current resident until resume", () => {
  const runner = fakeScheduler();
  const flags: boolean[] = [];
  runner.bus.request((_now, resume) => {
    flags.push(resume);
    runner.bus.request((_next, resumed) => flags.push(resumed));
    runner.bus.setActive(false);
  });
  runner.tick(16);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.bus.snapshot().queued, 1);
  runner.bus.setActive(true);
  runner.tick(32);
  assert.deepEqual(flags, [false, true]);
});

test("200-resident integration: app background and manual pause cannot restart RAF prematurely", () => {
  const runner = fakeScheduler();
  const gate = new NativeResidentActivityGate(true, false, (active) => runner.bus.setActive(active));
  let updates = 0;
  for (let i = 0; i < 200; i++) {
    let ticks = 0;
    const step = (_timestamp: number, _resume: boolean): void => {
      updates++;
      if (++ticks < 3) runner.bus.request(step);
    };
    runner.bus.request(step);
  }
  runner.tick(16);
  assert.equal(updates, 200);
  gate.setForeground(false);
  assert.equal(runner.frames.size, 0, "background must release platform RAF");
  gate.setGamePaused(true);
  gate.setForeground(true);
  assert.equal(runner.frames.size, 0, "manual pause prevents resume on foreground");
  assert.equal(updates, 200, "no character progressed during suspended period");
  gate.setGamePaused(false);
  runner.tick(10_000);
  assert.equal(updates, 400);
  runner.tick(10_016);
  assert.equal(updates, 600);
  // 3 actually dispatched native frames plus one canceled when backgrounded.
  assert.equal(runner.requested, 4);
  assert.equal(runner.cancelled, 1);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("cancellation of last pending resident while paused cancels future resume work", () => {
  const runner = fakeScheduler();
  let calls = 0;
  const id = runner.bus.request(() => calls++);
  runner.bus.setActive(false);
  runner.bus.cancel(id);
  runner.bus.setActive(true);
  assert.equal(runner.frames.size, 0);
  assert.equal(calls, 0);
});


test("240-frame population churn stress: 200 residents, repeated pauses, unmounts and respawns", () => {
  const runner = fakeScheduler();
  const alive = Array<boolean>(200).fill(true);
  const handles = Array<number>(200).fill(0);
  const perResident = Array<number>(200).fill(0);
  let callbacks = 0;
  const makeStep = (i: number) => {
    const step = (): void => {
      assert.equal(runner.bus.snapshot().active, true, "no callback during suspension");
      assert.equal(alive[i], true, "unmounted resident must not receive a frame");
      callbacks++;
      perResident[i]++;
      handles[i] = runner.bus.request(step);
    };
    return step;
  };
  const steps = Array.from({ length: 200 }, (_, i) => makeStep(i));
  steps.forEach((step, i) => { handles[i] = runner.bus.request(step); });
  let expectedCallbacks = 0;
  for (let frame = 1; frame <= 240; frame++) {
    if (frame % 30 === 0) {
      const stale = [...runner.frames.values()][0]!;
      runner.bus.setActive(false);
      assert.equal(runner.frames.size, 0);
      assert.equal(runner.bus.snapshot().scheduled, false);
      runner.bus.setActive(true);
      stale(frame * 16); // obsolete canceled native callback arriving late
      assert.equal(callbacks, expectedCallbacks, "stale RAF must never dispatch");
      assert.equal(runner.frames.size, 1);
    }
    if (frame === 101) {
      for (let i = 0; i < 40; i++) {
        alive[i] = false;
        runner.bus.cancel(handles[i]);
      }
    }
    if (frame === 151) {
      for (let i = 0; i < 40; i++) {
        alive[i] = true;
        handles[i] = runner.bus.request(steps[i]!);
      }
    }
    const activeCount = alive.filter(Boolean).length;
    runner.tick(frame * 16);
    expectedCallbacks += activeCount;
    assert.equal(callbacks, expectedCallbacks);
    assert.equal(runner.bus.snapshot().queued, activeCount);
    assert.equal(runner.frames.size, 1);
  }
  handles.forEach((id) => runner.bus.cancel(id));
  assert.equal(runner.bus.snapshot().queued, 0);
  assert.equal(runner.frames.size, 0);
  assert.equal(callbacks, expectedCallbacks);
  assert.equal(runner.bus.snapshot().dispatchCount, 240);
  assert.equal(runner.requested, 249, "one initial RAF, 240 subsequent frames, eight pause/resume replacements");
  assert.ok(perResident.every((count) => count > 0));
});

test("200 stable lifecycle subscriptions survive 1,000 route updates without listener churn", () => {
  const runner = fakeScheduler();
  const residents = 200;
  const currentRoute = Array.from({ length: residents }, (_, i) => i);
  const received = Array.from({ length: residents }, () => [] as number[]);
  // Like a committed-props ref: one stable listener reads the latest route.
  const unsubscribe = currentRoute.map((_, i) =>
    runner.bus.subscribeActivity((active) => {
      if (active) received[i]!.push(currentRoute[i]!);
    })
  );
  assert.equal(runner.bus.snapshot().activityListeners, residents);
  for (let i = 0; i < 1000; i++) {
    currentRoute[i % residents] = i + 1000;
    assert.equal(runner.bus.snapshot().activityListeners, residents);
  }
  for (let cycle = 0; cycle < 20; cycle++) {
    runner.bus.setActive(false);
    runner.bus.setActive(true);
  }
  assert.ok(received.every((values, i) =>
    values.length === 20 && values.every((v) => v === currentRoute[i])
  ), "every resident must observe its latest committed route");
  unsubscribe.forEach(fn => fn());
  assert.equal(runner.bus.snapshot().activityListeners, 0);
  runner.bus.setActive(false);
  runner.bus.setActive(true);
  assert.ok(received.every(values => values.length === 20), "unmounted residents never resume");
});

test("lifecycle dispatch skips a sibling removed synchronously by another listener", () => {
  const runner = fakeScheduler();
  const calls: string[] = [];
  let unsubscribeSecond = () => {};
  runner.bus.subscribeActivity(() => {
    calls.push("first");
    unsubscribeSecond();
  });
  unsubscribeSecond = runner.bus.subscribeActivity(() => calls.push("unmounted"));
  runner.bus.subscribeActivity(() => calls.push("third"));
  runner.bus.setActive(false);
  assert.deepEqual(calls, ["first", "third"]);
  assert.equal(runner.bus.snapshot().activityListeners, 2);
  runner.bus.setActive(true);
  assert.deepEqual(calls, ["first", "third", "first", "third"]);
});

test("200 resident listener churn with unmounts during transition never invokes disposed callbacks", () => {
  const runner = fakeScheduler();
  const active = Array(200).fill(true);
  const received = Array(200).fill(0);
  const disposers: Array<() => void> = [];
  for (let i = 0; i < 200; i++) {
    disposers[i] = runner.bus.subscribeActivity((next) => {
      assert.equal(active[i], true, "disposed resident must never receive lifecycle event");
      if (next) received[i]++;
      // A parent may remove other residents while processing a transition.
      if (i === 0 && !next) {
        for (let j = 100; j < 150; j++) {
          active[j] = false;
          disposers[j]!();
        }
      }
    });
  }
  runner.bus.setActive(false);
  assert.equal(runner.bus.snapshot().activityListeners, 150);
  runner.bus.setActive(true);
  assert.equal(received.reduce((a, b) => a + b, 0), 150);
  for (let i = 0; i < 200; i++) {
    if (active[i]) {
      active[i] = false;
      disposers[i]!();
    }
  }
  assert.equal(runner.bus.snapshot().activityListeners, 0);
  assert.equal(runner.frames.size, 0);
});
