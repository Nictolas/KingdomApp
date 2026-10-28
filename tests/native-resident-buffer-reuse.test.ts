import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import {
  NativeResidentTimerQueue,
  NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
} from "../src/performance/nativeResidentTimerQueue.ts";

function fakeFrames() {
  let nextId = 0;
  let requests = 0;
  const callbacks = new Map<number, (now: number) => void>();
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextId; callbacks.set(id, cb); requests++; return id; },
    id => { callbacks.delete(id); }
  );
  return {
    bus, callbacks,
    get requests() { return requests; },
    tick(now: number) {
      assert.equal(callbacks.size, 1, "there must be only one active platform RAF");
      const [id, callback] = callbacks.entries().next().value!;
      callbacks.delete(id);
      callback(now);
      assert.ok(callbacks.size <= 1, "a frame created duplicate native RAFs");
    }
  };
}

test("200 persistent sprites / 2,400 frames: no one-shot Map swap or extra platform RAF", () => {
  const f = fakeFrames();
  let calls = 0;
  const ids = Array.from({ length: 200 }, () => f.bus.subscribeFrame(() => { calls++; }));
  for (let frame = 1; frame <= 2400; frame++) {
    f.tick(frame * 16);
    assert.equal(f.bus.snapshot().oneShotBufferSwaps, 0);
  }
  assert.equal(calls, 480_000);
  assert.equal(f.requests, 2401);
  assert.equal(f.bus.snapshot().continuousSubscribers, 200);
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("200 legacy one-shot sprites / 240 frames: exactly two Maps recycled with no churn", () => {
  const f = fakeFrames();
  const internals = f.bus as unknown as { pending: object; sparePending: object };
  const originalBuffers = new Set([internals.pending, internals.sparePending]);
  assert.equal(originalBuffers.size, 2, "one-shot dispatch must own two distinct buffers");
  let updates = 0;
  for (let resident = 0; resident < 200; resident++) {
    let count = 0;
    const step = () => {
      count++;
      updates++;
      if (count < 240) f.bus.request(step);
    };
    f.bus.request(step);
  }
  for (let frame = 1; frame <= 240; frame++) {
    f.tick(frame * 16);
    assert.ok(originalBuffers.has(internals.pending), "new pending Map allocated");
    assert.ok(originalBuffers.has(internals.sparePending), "new spare Map allocated");
    assert.notEqual(internals.pending, internals.sparePending, "buffers aliased");
    assert.equal(f.bus.snapshot().oneShotBufferSwaps, frame);
  }
  assert.equal(updates, 48_000);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.requests, 240);
});

test("one-shot recycling retains FIFO through reentrant pause, cancellation and new requests", () => {
  const f = fakeFrames();
  const internals = f.bus as unknown as { pending: object; sparePending: object };
  const originalBuffers = new Set([internals.pending, internals.sparePending]);
  const events: string[] = [];
  f.bus.request(() => {
    events.push("first");
    f.bus.cancel(cancelled);
    f.bus.request((_now, resumed) => {
      assert.equal(resumed, true);
      events.push("new");
    });
    f.bus.setActive(false);
  });
  const cancelled = f.bus.request(() => events.push("CANCELLED"));
  f.bus.request((_now, resumed) => {
    assert.equal(resumed, true);
    events.push("remaining");
  });
  f.tick(16);
  assert.deepEqual(events, ["first"]);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.bus.snapshot().queued, 2);
  f.bus.setActive(true);
  f.tick(100_000);
  assert.deepEqual(events, ["first", "remaining", "new"]);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.callbacks.size, 0);
  assert.ok(originalBuffers.has(internals.pending));
  assert.ok(originalBuffers.has(internals.sparePending));
});

test("200 timer deadlines: reuse a single ready Map during pause, cancellation and 32-callback bursts", () => {
  let wall = 0;
  let nextId = 0;
  const platform = new Map<number, { due: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++nextId;
      platform.set(id, { due: wall + delay, callback });
      return id;
    },
    id => { platform.delete(id); },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET,
    6
  );
  const internals = queue as unknown as { readyBuffer: Map<number, unknown> };
  const originalBuffer = internals.readyBuffer;
  const order: number[] = [];
  const timerIds: number[] = [];
  for (let i = 0; i < 200; i++) {
    timerIds.push(queue.schedule(() => {
      order.push(i);
      if (i === 0) {
        queue.cancel(timerIds[1]!); // Cancel a sibling already in the extracted prefix.
        queue.schedule(() => order.push(200), 0);
        queue.setActive(false); // The unexecuted prefix must be put back.
      }
    }, 900));
  }
  assert.equal(platform.size, 1);
  wall = 900;
  function fire() {
    assert.equal(platform.size, 1);
    const [id, due] = platform.entries().next().value!;
    assert.ok(due.due <= wall);
    platform.delete(id);
    due.callback();
    assert.equal(internals.readyBuffer, originalBuffer, "a new ready Map was allocated");
    assert.equal(internals.readyBuffer.size, 0, "ready Map retained callbacks");
  }
  fire();
  assert.deepEqual(order, [0]);
  assert.equal(platform.size, 0);
  assert.equal(queue.snapshot().pending, 199);
  wall = 100_000;
  queue.setActive(true);
  let turns = 0;
  while (platform.size) {
    fire();
    if (++turns > 10) throw new Error("timer backlog stopped draining");
  }
  assert.equal(turns, 7, "cooperative batching still drains in seven resumed turns");
  assert.deepEqual(order, [0, ...Array.from({ length: 198 }, (_, i) => i + 2), 200]);
  assert.equal(queue.snapshot().readyBufferUses, 8);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(queue.snapshot().logicalCallbacks, 200);
  assert.equal(platform.size, 0);
});

test("2,000 timer callbacks and mid-flush cancellations: no retained callbacks or duplicate dispatch", () => {
  let wall = 0;
  let id = 0;
  const platform = new Map<number, { due: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => { const key = ++id; platform.set(key, { due: wall + delay, callback }); return key; },
    key => { platform.delete(key); },
    32,
    6
  );
  const internals = queue as unknown as { readyBuffer: Map<number, unknown> };
  const originalBuffer = internals.readyBuffer;
  const events: number[] = [];
  const handles = Array.from({ length: 2000 }, (_, i) =>
    queue.schedule(() => events.push(i), 100)
  );
  for (let i = 0; i < handles.length; i += 11) queue.cancel(handles[i]!);
  wall = 100;
  let wakeups = 0;
  while (platform.size) {
    const [key, task] = platform.entries().next().value!;
    assert.ok(task.due <= wall);
    platform.delete(key);
    task.callback();
    wakeups++;
    assert.equal(internals.readyBuffer, originalBuffer);
    assert.equal(internals.readyBuffer.size, 0);
    assert.ok(wakeups < 100, "work stalled");
  }
  assert.deepEqual(events, Array.from({ length: 2000 }, (_, i) => i).filter(i => i % 11 !== 0));
  assert.equal(queue.snapshot().readyBufferUses, wakeups);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(queue.snapshot().logicalCallbacks, events.length);
  assert.equal(new Set(events).size, events.length);
});
