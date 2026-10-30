import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

/** Deterministic fake OS; counts JS dispatches, never physical phone FPS. */
function fakeOs() {
  const pending = new Map<number, (timestamp: number) => void>();
  let next = 0;
  let requests = 0;
  let cancellations = 0;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; pending.set(id, cb); requests++; return id; },
    id => { pending.delete(id); cancellations++; }
  );
  return {
    bus, pending,
    get requests() { return requests; },
    get cancellations() { return cancellations; },
    tick(timestamp: number) {
      assert.equal(pending.size, 1, "exactly one native RAF must be pending");
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback(timestamp);
      assert.ok(pending.size <= 1, "duplicate native RAF");
    }
  };
}

test("200 persistent residents: 480 frames without Map entries iterator or per-frame visitor", () => {
  const f = fakeOs();
  const internals = f.bus as unknown as {
    continuous: Map<number, unknown>;
    visitContinuous: Function;
  };
  const continuous = internals.continuous;
  const visitor = internals.visitContinuous;
  const calls = Array<number>(200).fill(0);
  const handles = Array.from({ length: 200 }, (_, i) =>
    f.bus.subscribeFrame(() => { calls[i]!++; })
  );
  // If the hot path regresses to for..of, this throws on its first frame.
  Object.defineProperty(continuous, Symbol.iterator, {
    value: () => { throw new Error("persistent Map iterator regression"); }
  });
  Object.defineProperty(continuous, "entries", {
    value: () => { throw new Error("persistent Map entries regression"); }
  });
  for (let frame = 1; frame <= 480; frame++) {
    f.tick(frame * 16);
    assert.equal(internals.continuous, continuous);
    assert.equal(internals.visitContinuous, visitor);
    assert.equal(f.bus.snapshot().oneShotBufferSwaps, 0);
  }
  assert.ok(calls.every(count => count === 480));
  assert.equal(f.requests, 481);
  assert.equal(f.bus.snapshot().subscriptionAdds, 200);
  handles.forEach(id => f.bus.cancel(id));
  assert.equal(f.pending.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("persistent callback reentrancy: cancel sibling, add next-frame subscriber, pause/resume mid-dispatch", () => {
  const f = fakeOs();
  const events: Array<[number, boolean]> = [];
  const handles: number[] = [];
  let transitioned = false;
  let newcomer = 0;
  for (let i = 0; i < 200; i++) {
    handles.push(f.bus.subscribeFrame((_time, resumed) => {
      events.push([i, resumed]);
      if (i === 0 && !transitioned) {
        transitioned = true;
        f.bus.cancel(handles[1]!);
        newcomer = f.bus.subscribeFrame((_next, rebase) => events.push([200, rebase]));
        f.bus.setActive(false);
        f.bus.setActive(true);
      }
    }));
  }
  const canceledCallback = f.pending.values().next().value!;
  f.tick(16);
  assert.deepEqual(events, [[0, false]], "no other resident runs after an epoch transition");
  assert.equal(f.bus.snapshot().continuousSubscribers, 200);
  canceledCallback(99999); // canceled/stale platform callback cannot run twice
  assert.deepEqual(events, [[0, false]]);
  f.tick(32);
  assert.equal(events.length, 201);
  assert.deepEqual(events.slice(1).map(([id]) => id),
    [0, ...Array.from({ length: 198 }, (_, i) => i + 2), 200]);
  assert.ok(events.slice(1).every(([, resumed]) => resumed));
  f.tick(48);
  assert.equal(events.length, 401);
  assert.ok(events.slice(201).every(([, resumed]) => !resumed));
  handles.forEach(id => f.bus.cancel(id));
  f.bus.cancel(newcomer);
  assert.equal(f.pending.size, 0);
});

test("mixed one-shot/persistent failures preserve the first thrown value and clear retained errors", () => {
  const f = fakeOs();
  let healthy = 0;
  const broken = f.bus.subscribeFrame(() => { throw null; });
  const healthyIds = Array.from({ length: 199 }, () =>
    f.bus.subscribeFrame(() => { healthy++; })
  );
  f.bus.request(() => { throw 0; });
  let caught: unknown = Symbol("not thrown");
  try { f.tick(16); } catch (error) { caught = error; }
  assert.equal(caught, 0, "first one-shot failure must win over later persistent failure");
  assert.equal(healthy, 199);
  const internals = f.bus as unknown as { continuousFirstError: unknown; continuousHasError: boolean };
  assert.equal(internals.continuousFirstError, undefined, "error object must not leak between RAFs");
  assert.equal(internals.continuousHasError, false);
  caught = Symbol("not thrown");
  try { f.tick(32); } catch (error) { caught = error; }
  assert.equal(caught, null, "falsy persistent error must not be swallowed");
  assert.equal(healthy, 398);
  assert.equal(internals.continuousFirstError, undefined);
  f.bus.cancel(broken);
  f.tick(48);
  assert.equal(healthy, 597);
  healthyIds.forEach(id => f.bus.cancel(id));
  assert.equal(f.pending.size, 0);
});

test("200 resident soak: 2,000 frames, speed changes, unmount/remount and stale RAF after background", () => {
  const f = fakeOs();
  const count = 200;
  const positions = Array<number>(count).fill(0);
  const calls = Array<number>(count).fill(0);
  const handles = Array<number>(count).fill(0);
  let speed = 1;
  const callbacks = Array.from({ length: count }, (_, i) =>
    () => { positions[i]! += speed; calls[i]!++; }
  );
  for (let i = 0; i < count; i++) handles[i] = f.bus.subscribeFrame(callbacks[i]!);
  for (let frame = 1; frame <= 2000; frame++) {
    speed = frame % 3 === 0 ? 4 : frame % 3 === 1 ? 1 : 2;
    if (frame % 100 === 0) {
      const stale = f.pending.values().next().value!;
      f.bus.setActive(false);
      assert.equal(f.pending.size, 0);
      f.bus.setActive(true);
      stale(frame * 16 + 1);
    }
    if (frame % 250 === 0) {
      for (let i = 0; i < 20; i++) {
        f.bus.cancel(handles[i]!);
        handles[i] = f.bus.subscribeFrame(callbacks[i]!);
      }
    }
    f.tick(frame * 16);
    assert.equal(f.bus.snapshot().continuousSubscribers, count);
  }
  assert.ok(calls.every(n => n === 2000), "no duplicate or missing frame after route churn");
  const expected = Array.from({ length: 2000 }, (_, i) =>
    (i + 1) % 3 === 0 ? 4 : (i + 1) % 3 === 1 ? 1 : 2
  ).reduce((a, b) => a + b, 0);
  assert.ok(positions.every(n => n === expected));
  assert.equal(f.bus.snapshot().dispatchCount, 2000);
  assert.equal(f.bus.snapshot().oneShotBufferSwaps, 0);
  assert.equal(f.requests, 2021, "one platform RAF per turn plus 20 canceled background frames");
  handles.forEach(id => f.bus.cancel(id));
  assert.equal(f.pending.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});
