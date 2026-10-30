import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

// Fake platform callbacks: correctness/integration checks, NOT physical FPS.
function setup() {
  let next = 0;
  const os = new Map<number, (at: number) => void>();
  const stale: Array<(at: number) => void> = [];
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; os.set(id, cb); return id; },
    id => { const cb = os.get(id); if (cb) stale.push(cb); os.delete(id); }
  );
  return {
    bus, os, stale,
    frame(at: number) {
      assert.equal(os.size, 1, "at most one live OS RAF for 200 residents");
      const [id, cb] = os.entries().next().value!;
      os.delete(id);
      cb(at);
    }
  };
}
function capture(fn: () => void): { caught: boolean; value: unknown } {
  let caught = false; let value: unknown;
  try { fn(); } catch (error) { caught = true; value = error; }
  return { caught, value };
}

test("200 one-shot callbacks isolate undefined errors and preserve the first thrown value", () => {
  const f = setup();
  const seen: number[] = [];
  for (let i = 0; i < 200; i++) f.bus.request(() => {
    seen.push(i);
    if (i === 0) throw undefined;
    if (i === 1) throw Error("later failure");
  });
  const failure = capture(() => f.frame(16));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, undefined);
  assert.deepEqual(seen, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
  f.bus.request(() => seen.push(200));
  f.frame(32);
  assert.equal(seen.at(-1), 200);
});

test("200 persistent walkers: falsy callback failures cannot starve healthy siblings", () => {
  const f = setup();
  const values: unknown[] = [null, false, 0, "", undefined];
  const counts = Array<number>(200).fill(0);
  const rebase = Array<boolean>(200).fill(false);
  const ids = Array.from({ length: 200 }, (_, i) => f.bus.subscribeFrame((_at, resumed) => {
    counts[i]!++;
    rebase[i] = resumed;
    if (i < values.length) throw values[i];
  }));
  const first = capture(() => f.frame(16));
  assert.equal(first.caught, true);
  assert.equal(first.value, null);
  assert.ok(counts.every(v => v === 1));
  assert.equal(f.os.size, 1);
  ids.slice(0, values.length).forEach(id => f.bus.cancel(id));
  f.frame(32);
  assert.ok(counts.every((v, i) => v === (i < values.length ? 1 : 2)));
  f.bus.setActive(false);
  assert.equal(f.os.size, 0);
  f.stale.forEach(cb => cb(50_000));
  f.bus.setActive(true);
  f.frame(50_016);
  assert.ok(rebase.every((v, i) => i < values.length || v));
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});

test("200 lifecycle listeners propagate false without skipping later notifications", () => {
  const f = setup();
  const values: unknown[] = [false, 0, "", null, undefined];
  const counts = Array<number>(200).fill(0);
  const unsub = Array.from({ length: 200 }, (_, i) => f.bus.subscribeActivity(() => {
    counts[i]!++;
    if (i < values.length) throw values[i];
  }));
  for (const active of [false, true]) {
    const failure = capture(() => f.bus.setActive(active));
    assert.equal(failure.caught, true);
    assert.equal(failure.value, false);
    assert.equal(f.bus.snapshot().active, active);
  }
  assert.ok(counts.every(v => v === 2));
  unsub.forEach(fn => fn());
  f.bus.setActive(false);
  f.bus.setActive(true);
  assert.equal(f.bus.snapshot().activityListeners, 0);
  assert.ok(counts.every(v => v === 2));
});

test("reentrant lifecycle transition and thrown empty string do not resurrect old state", () => {
  const f = setup();
  const states: string[] = [];
  f.bus.subscribeActivity(active => {
    states.push("first-" + active);
    if (!active) { f.bus.setActive(true); throw ""; }
  });
  f.bus.subscribeActivity(active => states.push("second-" + active));
  const failure = capture(() => f.bus.setActive(false));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, "");
  assert.deepEqual(states, ["first-false", "first-true", "second-true"]);
  assert.equal(f.bus.snapshot().active, true);
});

test("nested pause/resume plus undefined frame error defers 199 walkers until rebase frame", () => {
  const f = setup();
  const seen: number[] = [];
  const rebased: number[] = [];
  for (let i = 0; i < 200; i++) f.bus.request((_at, resumed) => {
    seen.push(i);
    if (resumed) rebased.push(i);
    if (i === 0) {
      f.bus.setActive(false);
      f.bus.setActive(true);
      throw undefined;
    }
  });
  const failure = capture(() => f.frame(16));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, undefined);
  assert.deepEqual(seen, [0]);
  assert.equal(f.bus.snapshot().queued, 199);
  f.frame(60_000);
  assert.deepEqual(seen, Array.from({ length: 200 }, (_, i) => i));
  assert.deepEqual(rebased, Array.from({ length: 199 }, (_, i) => i + 1));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});
