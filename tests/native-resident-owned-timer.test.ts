import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentOwnedTimer } from "../src/performance/nativeResidentOwnedTimer.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentRouteEpoch } from "../src/performance/nativeResidentRouteEpoch.ts";
import { PendingCommuteRetry } from "../src/game/pendingCommuteRetry.ts";

test("stale, reentrant canceled timers cannot erase or fire a newer resident wake", () => {
  let next = 0;
  const timers = new Map<number, () => void>();
  const callbacks: Array<() => void> = [];
  const events: string[] = [];
  const slot = new NativeResidentOwnedTimer(
    cb => { const id = ++next; timers.set(id, cb); callbacks.push(cb); return id; },
    id => {
      const stale = timers.get(id);
      timers.delete(id);
      stale?.(); // OS delivered a callback despite cancellation
    }
  );
  slot.schedule(() => events.push("obsolete"), 2200);
  assert.equal(slot.pending, true);
  slot.schedule(() => events.push("live"), 900);
  callbacks[0]!();
  assert.equal(slot.pending, true, "a stale closure cannot clear replacement ownership");
  assert.equal(events.length, 0);
  timers.get(2)!();
  assert.equal(events.join(","), "live");
  assert.equal(slot.pending, false);
  callbacks[1]!(); // delivery after it has already been consumed
  assert.equal(events.join(","), "live");
  slot.schedule(() => events.push("canceled"), 2200);
  slot.cancel();
  assert.equal(slot.pending, false);
  callbacks[2]!();
  assert.equal(events.join(","), "live");
  assert.throws(() => slot.schedule(() => {}, Number.NaN));
  assert.throws(() => slot.schedule(() => {}, -1));
  assert.equal(slot.pending, false);
});

test("timer rearming inside the callback never loses its replacement handle", () => {
  let next = 0;
  const timers = new Map<number, () => void>();
  const slot = new NativeResidentOwnedTimer(
    cb => { const id = ++next; timers.set(id, cb); return id; },
    id => { timers.delete(id); }
  );
  let called = 0;
  slot.schedule(() => {
    called++;
    assert.equal(slot.pending, false, "expired timer is consumed before callback");
    slot.schedule(() => called++, 900);
  }, 2200);
  timers.get(1)!();
  assert.equal(slot.pending, true);
  timers.get(1)!(); // replay the consumed callback
  assert.equal(slot.pending, true);
  assert.equal(called, 1);
  timers.get(2)!();
  assert.equal(called, 2);
  assert.equal(slot.pending, false);
});

test("synchronous platform delivery cannot accidentally adopt an already consumed timer", () => {
  let canceled = 0;
  let invoked = 0;
  const slot = new NativeResidentOwnedTimer(
    cb => { cb(); return 42; },
    id => { assert.equal(id, 42); canceled++; }
  );
  slot.schedule(() => { invoked++; }, 0);
  assert.equal(invoked, 1);
  assert.equal(canceled, 1);
  assert.equal(slot.pending, false);
});

test("200 real queue-backed resident slots: 60 route changes, late callbacks, 900ms retry and 2200ms idle, pause/foreground", () => {
  let wall = 0;
  let next = 0;
  const os = new Map<number, { due: number; fn: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (fn, delay) => { const id = ++next; os.set(id, { due: wall + delay, fn }); return id; },
    id => { os.delete(id); },
    32
  );
  const gate = new NativeResidentActivityGate(true, false, active => queue.setActive(active));
  let callbacks = 0, phantom = 0, retryCount = 0, idleCount = 0;
  const residents = Array.from({ length: 200 }, () => {
    const leaked: Array<() => void> = [];
    const epoch = new NativeResidentRouteEpoch();
    const held = new PendingCommuteRetry();
    const slot = new NativeResidentOwnedTimer(
      (cb, delay) => { leaked.push(cb); return queue.schedule(cb, delay); },
      id => queue.cancel(id)
    );
    return { slot, leaked, epoch, held, before: 0 };
  });
  const runDue = () => {
    let safety = 0;
    while (os.size) {
      const [id, timer] = [...os.entries()].sort((a, b) => a[1].due - b[1].due)[0]!;
      if (timer.due > wall) break;
      os.delete(id);
      timer.fn();
      if (++safety > 100) throw new Error("timer burst did not drain");
    }
  };
  for (let cycle = 0; cycle < 60; cycle++) {
    // An obsolete idle wake is superseded by a commute collision retry.
    for (const resident of residents) {
      resident.epoch.begin();
      resident.before = resident.leaked.length;
      resident.slot.schedule(() => { phantom++; }, 2200);
      const token = resident.epoch.begin();
      resident.held.hold(() => {
        if (resident.epoch.isCurrent(token)) retryCount++;
      });
      resident.slot.schedule(() => {
        if (!resident.epoch.isCurrent(token)) { phantom++; return; }
        resident.held.take()?.();
        callbacks++;
      }, 900);
      const stale = resident.leaked[resident.before]!;
      stale(); // canceled 2200ms wake delivered after 900ms replacement
      assert.equal(resident.slot.pending, true);
    }
    assert.equal(queue.snapshot().pending, 200);
    assert.ok(os.size <= 1);
    if (cycle % 6 === 0) {
      wall += 300;
      gate.setGamePaused(true);
      gate.setForeground(false);
      assert.equal(os.size, 0);
      wall += 90_000;
      gate.setGamePaused(false);
      assert.equal(os.size, 0);
      gate.setForeground(true);
      wall += 600;
    } else {
      wall += 900;
    }
    runDue();
    assert.equal(queue.snapshot().pending, 0);
    assert.ok(residents.every(r => !r.slot.pending));
    assert.equal(retryCount, (cycle + 1) * 200);
    assert.equal(callbacks, retryCount);
    assert.equal(phantom, 0);
    for (const resident of residents) {
      resident.epoch.invalidate();
      resident.held.clear();
      // Re-deliver both retired idle and retry callbacks after the next
      // logical wake, including one already consumed by the timer queue.
      for (const leaked of resident.leaked.splice(0)) leaked();
    }
    assert.equal(phantom, 0);
    assert.equal(queue.snapshot().pending, 0);
  }
  assert.equal(retryCount, 12_000);
  assert.equal(idleCount, 0);
  assert.ok(queue.snapshot().budgetYields > 0);
  assert.equal(os.size, 0);
  residents.forEach(r => { r.slot.cancel(); r.held.clear(); });
});

test("native renderer owns all idle/claim timeouts and web remains untouched", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(native, /new NativeResidentOwnedTimer\(scheduleNativeResidentTimer, cancelNativeResidentTimer\)/);
  // Both zero-candidate and denied-claim free-roam paths now converge on
  // the same owned 2200ms timer; the previous duplicate scheduling site is gone.
  assert.equal((native.match(/wakeTimer\\.schedule\\(/g) ?? []).length, 8);
  const idle = native.slice(native.indexOf("const pickNextMove = useCallback("),
    native.indexOf("pickNextMoveRef.current = pickNextMove;"));
  assert.match(idle, /neighborSampler\\.pick\\(/);
  assert.match(idle, /if \\(next == null\\) \\{[\\s\\S]*?wakeTimer\\.schedule\\(/);
  assert.match(native, /const clearIdle = useCallback\(\(\) => wakeTimer\.cancel\(\), \[wakeTimer\]\)/);
  assert.doesNotMatch(native, /idleTimerRef/);
  assert.doesNotMatch(web, /NativeResidentOwnedTimer|wakeTimer/);
});
