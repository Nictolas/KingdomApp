import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

/**
 * Inject native RAF bridge failures while retaining callbacks that the
 * platform might deliver after a failed registration/cancellation.
 * Node-only deterministic tests: NOT Android/iOS FPS or touch measurements.
 */
function fixture() {
  let id = 0;
  let failRequest: unknown;
  let requestFaultArmed = false;
  let failCancel: unknown;
  let cancelFaultArmed = false;
  let retainOnFailedRequest = false;
  const os = new Map<number, (at: number) => void>();
  const obsolete: Array<(at: number) => void> = [];
  const bus = new NativeResidentFrameBus(
    callback => {
      const handle = ++id;
      if (requestFaultArmed) {
        requestFaultArmed = false;
        if (retainOnFailedRequest) obsolete.push(callback);
        throw failRequest;
      }
      os.set(handle, callback);
      return handle;
    },
    handle => {
      const callback = os.get(handle);
      if (callback) obsolete.push(callback);
      os.delete(handle);
      if (cancelFaultArmed) {
        cancelFaultArmed = false;
        throw failCancel;
      }
    }
  );
  return {
    bus, os, obsolete,
    requestFails(value: unknown, callbackMayArrive = false) {
      failRequest = value;
      requestFaultArmed = true;
      retainOnFailedRequest = callbackMayArrive;
    },
    cancelFails(value: unknown) {
      failCancel = value;
      cancelFaultArmed = true;
    },
    tick(at: number) {
      assert.equal(os.size, 1, "exactly one live native RAF is permitted");
      const [handle, callback] = os.entries().next().value!;
      os.delete(handle);
      callback(at);
    },
    deliverObsolete(at: number) {
      for (const callback of obsolete.splice(0)) callback(at);
    }
  };
}

function caught(fn: () => void): { thrown: boolean; value: unknown } {
  try { fn(); return { thrown: false, value: undefined }; }
  catch (value) { return { thrown: true, value }; }
}

test("200 persistent residents: original thrown null survives a failed RAF rearm", () => {
  const f = fixture();
  const hits = Array<number>(200).fill(0);
  const handles = Array.from({ length: 200 }, (_, i) => f.bus.subscribeFrame(() => {
    hits[i]!++;
    if (i === 0) {
      f.requestFails(new Error("native RAF bridge offline"), true);
      throw null;
    }
  }));
  const result = caught(() => f.tick(16));
  assert.equal(result.thrown, true);
  assert.equal(result.value, null, "the resident exception must not be masked");
  assert.ok(hits.every(n => n === 1), "all healthy siblings still dispatch");
  assert.equal(f.bus.snapshot().platformRequestFailures, 1);
  assert.equal(f.bus.snapshot().postDispatchRearmFailures, 1);
  assert.equal(f.bus.snapshot().continuousSubscribers, 200);
  assert.equal(f.bus.snapshot().scheduled, false);
  f.deliverObsolete(32);
  assert.ok(hits.every(n => n === 1), "unowned OS callback must be ignored");
  f.bus.cancel(handles[0]!);
  f.bus.setActive(true); // idempotent foreground transition retries bridge
  assert.equal(f.os.size, 1);
  f.tick(48);
  assert.ok(hits.every((n, i) => n === (i === 0 ? 1 : 2)));
  handles.forEach(handle => f.bus.cancel(handle));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});

test("200 one-shots: preserve thrown 0, retain next-frame work and reject stale RAF", () => {
  const f = fixture();
  const observed: number[] = [];
  for (let i = 0; i < 200; i++) f.bus.request(() => {
    observed.push(i);
    if (i === 0) {
      f.bus.request(() => observed.push(200));
      f.requestFails("request bridge failed", true);
      throw 0;
    }
  });
  const result = caught(() => f.tick(16));
  assert.equal(result.thrown, true);
  assert.equal(result.value, 0);
  assert.deepEqual(observed, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.bus.snapshot().queued, 1);
  assert.equal(f.bus.snapshot().scheduled, false);
  f.deliverObsolete(32);
  assert.equal(observed.length, 200);
  f.bus.setActive(true);
  f.tick(48);
  assert.equal(observed.at(-1), 200);
  assert.equal(observed.length, 201);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});

test("200 persistent walkers: bridge-only rearm fault propagates and later registration recovers", () => {
  const f = fixture();
  const counts = Array<number>(200).fill(0);
  const handles = Array.from({ length: 200 }, (_, i) => f.bus.subscribeFrame(() => {
    counts[i]!++;
    if (i === 0 && counts[i] === 1) f.requestFails(false, true);
  }));
  const result = caught(() => f.tick(16));
  assert.equal(result.thrown, true);
  assert.equal(result.value, false, "falsy bridge errors must not be swallowed");
  assert.equal(f.bus.snapshot().platformRequestFailures, 1);
  assert.equal(f.bus.snapshot().postDispatchRearmFailures, 1);
  assert.ok(counts.every(n => n === 1));
  const extra = f.bus.subscribeFrame(() => {});
  f.deliverObsolete(999);
  assert.ok(counts.every(n => n === 1));
  f.tick(1_016);
  assert.ok(counts.every(n => n === 2));
  handles.forEach(handle => f.bus.cancel(handle));
  f.bus.cancel(extra);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("last unmount and pause cancellation faults are counted, never revive stale callbacks", () => {
  const f = fixture();
  let called = 0;
  const first = f.bus.subscribeFrame(() => { called++; });
  f.cancelFails("");
  const cancellation = caught(() => f.bus.cancel(first));
  assert.equal(cancellation.thrown, true);
  assert.equal(cancellation.value, "");
  assert.equal(f.bus.snapshot().platformCancelFailures, 1);
  assert.equal(f.bus.snapshot().scheduled, false);
  const handles = Array.from({ length: 200 }, () =>
    f.bus.subscribeFrame(() => { called++; }));
  f.cancelFails(null);
  const pause = caught(() => f.bus.setActive(false));
  assert.equal(pause.thrown, true);
  assert.equal(pause.value, null);
  assert.equal(f.bus.snapshot().platformCancelFailures, 2);
  assert.equal(f.bus.snapshot().active, false);
  f.deliverObsolete(60_000);
  assert.equal(called, 0);
  f.bus.setActive(true);
  f.deliverObsolete(60_016);
  assert.equal(called, 0);
  f.tick(60_032);
  assert.equal(called, 200);
  handles.forEach(handle => f.bus.cancel(handle));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});

test("200-resident, 120-frame fault soak: recovery does not duplicate RAF or lose residents", () => {
  const f = fixture();
  const counts = Array<number>(200).fill(0);
  const handles = Array.from({ length: 200 }, (_, i) =>
    f.bus.subscribeFrame(() => { counts[i]!++; }));
  for (let frame = 1; frame <= 120; frame++) {
    if (frame % 15 === 0) {
      // Request registration fails at the end of this frame. A later
      // idempotent foreground signal must restore exactly one platform RAF.
      const injected = new Error("intermittent bridge outage");
      const hook = f.bus.subscribeFrame(() => {
        f.requestFails(injected, true);
        f.bus.cancel(hook);
      });
      const result = caught(() => f.tick(frame * 16));
      assert.equal(result.thrown, true);
      assert.equal(result.value, injected);
      assert.equal(f.bus.snapshot().scheduled, false);
      f.deliverObsolete(frame * 16 + 1);
      f.bus.setActive(true);
    } else {
      f.tick(frame * 16);
    }
    assert.equal(f.os.size, 1);
    assert.ok(counts.every(n => n === frame));
  }
  assert.equal(f.bus.snapshot().platformRequestFailures, 8);
  assert.equal(f.bus.snapshot().postDispatchRearmFailures, 8);
  handles.forEach(handle => f.bus.cancel(handle));
  assert.equal(f.os.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});
