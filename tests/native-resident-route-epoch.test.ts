import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentRouteEpoch } from "../src/performance/nativeResidentRouteEpoch.ts";
import { NativeResidentCollisionRetry } from "../src/performance/nativeResidentCollisionRetry.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { PendingCommuteRetry } from "../src/game/pendingCommuteRetry.ts";

test("native route epoch invalidates old callbacks after reroute and cleanup", () => {
  const epoch = new NativeResidentRouteEpoch();
  let previous = epoch.begin();
  for (let i = 0; i < 10_000; i++) {
    const current = epoch.begin();
    assert.equal(epoch.isCurrent(previous), false);
    assert.equal(epoch.isCurrent(current), true);
    epoch.invalidate();
    assert.equal(epoch.isCurrent(current), false);
    previous = current;
  }
  assert.equal(epoch.isCurrent(0), false);
});

test("200 residents, 40 reroutes each, 8000 stale and 8000 live retry callbacks with pause", () => {
  let wall = 0, nextId = 0;
  const os = new Map<number, { at: number; cb: () => void }>();
  const staleOS: Array<() => void> = [];
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (cb, delay) => { const id = ++nextId; os.set(id, { at: wall + delay, cb }); return id; },
    id => { const old = os.get(id); if (old) staleOS.push(old.cb); os.delete(id); },
    32
  );
  const gate = new NativeResidentActivityGate(true, false, active => queue.setActive(active));
  const residents = Array.from({ length: 200 }, () => ({
    epoch: new NativeResidentRouteEpoch(),
    retry: new NativeResidentCollisionRetry(3),
    pending: new PendingCommuteRetry(),
    timer: null as number | null,
    resumed: 0,
    stale: 0
  }));
  const start = (r: typeof residents[number]) => {
    const token = r.epoch.begin();
    r.retry.reset();
    r.pending.clear();
    assert.equal(r.retry.fail(true), "retry");
    assert.equal(r.retry.fail(true), "retry");
    assert.equal(r.retry.fail(true), "request-repath");
    const generation = r.retry.repathGeneration();
    r.pending.hold(() => {
      if (r.epoch.isCurrent(token) && r.retry.resumeWithoutRepath(generation)) r.resumed++;
    });
    const callback = () => {
      if (!r.epoch.isCurrent(token)) { r.stale++; return; }
      r.timer = null;
      r.pending.take()?.();
    };
    r.timer = queue.schedule(callback, 900);
    return callback;
  };
  for (let cycle = 0; cycle < 40; cycle++) {
    const obsolete = residents.map(start);
    for (const r of residents) {
      r.epoch.invalidate();
      if (r.timer !== null) queue.cancel(r.timer);
      r.pending.clear();
      r.timer = null;
    }
    residents.forEach(start);
    obsolete.forEach(cb => cb());
    assert.equal(queue.snapshot().pending, 200);
    assert.ok(residents.every(r => r.timer !== null));
    assert.ok(os.size <= 1);
    if (cycle % 5 === 0) {
      wall += 300;
      gate.setGamePaused(true);
      gate.setForeground(false);
      assert.equal(os.size, 0);
      wall += 50_000;
      gate.setGamePaused(false);
      assert.equal(os.size, 0);
      gate.setForeground(true);
      wall += 600;
    } else {
      wall += 900;
    }
    let wakes = 0;
    while (os.size) {
      const [id, alarm] = os.entries().next().value!;
      assert.ok(alarm.at <= wall);
      os.delete(id);
      alarm.cb();
      if (++wakes > 12) throw new Error("unbounded retry burst");
    }
    assert.ok(residents.every(r => r.resumed === cycle + 1));
    for (const cb of staleOS.splice(0)) cb();
    assert.ok(residents.every(r => r.resumed === cycle + 1));
    assert.equal(queue.snapshot().pending, 0);
  }
  assert.equal(residents.reduce((sum, r) => sum + r.resumed, 0), 8000);
  assert.equal(residents.reduce((sum, r) => sum + r.stale, 0), 8000);
  assert.equal(queue.snapshot().logicalCallbacks, 8000);
  residents.forEach(r => { r.epoch.invalidate(); r.pending.clear(); assert.equal(r.timer, null); });
  gate.setForeground(false);
  assert.equal(os.size, 0);
});

test("native wiring guards both retry timers before clearing or taking new route state", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(native, /routeEpoch\.begin\(\)/);
  assert.match(native, /routeEpoch\.invalidate\(\)/);
  const retry = native.slice(native.indexOf("const runOneSegment"), native.indexOf("/** Percorso casa"));
  const blocks = [...retry.matchAll(/wakeTimer\.schedule\(\(\) => \{([\s\S]*?)\}, CLAIM_RETRY_MS\)/g)];
  assert.equal(blocks.length, 2);
  for (const match of blocks) {
    const body = match[1]!;
    assert.match(body, /routeEpoch\.isCurrent\(routeToken\)/);
    assert.ok(body.indexOf("routeEpoch.isCurrent(routeToken)") <
      body.indexOf("pendingCommuteRetry.take()"));
  }
  // Even an OS callback delivered after cancel cannot clear or execute a
  // replacement wake: timer ownership is validated before invoking callbacks.
  assert.match(native, /new NativeResidentOwnedTimer\(scheduleNativeResidentTimer, cancelNativeResidentTimer\)/);
  assert.doesNotMatch(retry, /idleTimerRef\.current/);
  assert.match(retry, /if \(routeEpoch\.isCurrent\(routeToken\) && claimRetry\.resumeWithoutRepath/);
  assert.match(retry, /onArrival: \(\) => \{\s*if \(!routeEpoch\.isCurrent\(routeToken\)\) return;/);
  assert.doesNotMatch(web, /NativeResidentRouteEpoch|routeEpoch/);
});

test("200 residents, 60 cycles: a reentrant arrival cannot continue its obsolete commute", () => {
  const residents = Array.from({ length: 200 }, () => new NativeResidentRouteEpoch());
  let settled = 0, obsoleteContinuations = 0, validContinuations = 0;
  for (let cycle = 0; cycle < 60; cycle++) {
    for (let i = 0; i < residents.length; i++) {
      const epoch = residents[i]!;
      const token = epoch.begin();
      const replaceDuringNotification = (cycle + i) % 3 !== 0;
      const owned = epoch.runIfCurrent(token, () => {
        settled++;
        if (replaceDuringNotification) epoch.begin(); // parent replaces path synchronously
      });
      if (owned) {
        assert.equal(replaceDuringNotification, false);
        validContinuations++;
        assert.equal(epoch.isCurrent(token), true);
      } else {
        // Native onArrival must not call its old onDone after notification.
        if (epoch.isCurrent(token)) obsoleteContinuations++;
        assert.equal(epoch.isCurrent(token), false);
      }
      assert.equal(epoch.runIfCurrent(token, () => {
        // Late arrival delivery on the replaced route must do nothing.
        if (replaceDuringNotification) obsoleteContinuations++;
      }), !replaceDuringNotification);
      epoch.invalidate();
      assert.equal(epoch.runIfCurrent(token, () => { obsoleteContinuations++; }), false);
    }
  }
  assert.equal(settled, 12_000);
  assert.equal(validContinuations, 4_000);
  assert.equal(obsoleteContinuations, 0);
});

test("200 resident commute completions are delivered at most once, even with reentrant parent changes", () => {
  const epochs = Array.from({ length: 200 }, () => new NativeResidentRouteEpoch());
  let completions = 0, duplicateCompletions = 0;
  for (let cycle = 0; cycle < 40; cycle++) {
    for (let id = 0; id < epochs.length; id++) {
      const epoch = epochs[id]!;
      const token = epoch.begin();
      let completionEmitted = false;
      const finish = () => {
        if (completionEmitted || !epoch.isCurrent(token)) return;
        completionEmitted = true;
        epoch.runIfCurrent(token, () => {
          completions++;
          if (id % 2 === 0) epoch.begin(); // synchronous route replacement
        });
      };
      finish();
      finish(); // delivered twice by a faulty upstream event
      epoch.invalidate();
      finish(); // late native callback
      if (!completionEmitted) duplicateCompletions++;
    }
  }
  assert.equal(completions, 8_000);
  assert.equal(duplicateCompletions, 0);
});

test("source boundary: terminal commute neither re-arms idle nor continues after an invalidating arrival", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  const commuteStart = native.slice(native.indexOf('    const routeToken = routeEpoch.begin();'),
    native.indexOf('    let seg = 0;'));
  assert.match(commuteStart, /onCellSettledRef\.current\?\.\(start\)/);
  assert.doesNotMatch(commuteStart.slice(commuteStart.lastIndexOf('onCellSettledRef.current?.(start);')),
    /if \(!routeEpoch\.isCurrent\(routeToken\)\) return/);
  const route = native.slice(native.indexOf('    let seg = 0;'), native.indexOf('    stepChain();'));
  assert.ok(route.startsWith("    let seg = 0;"));
  assert.match(route, /let completionEmitted = false/);
  assert.match(route, /if \(completionEmitted\) return/);
  const completion = route.slice(route.indexOf('if (seg >= path.length - 1)'), route.indexOf('const from = path[seg]!'));
  assert.match(completion, /routeEpoch\.runIfCurrent\(routeToken/);
  assert.doesNotMatch(completion, /scheduleNativeResidentTimer|pickNextMoveRef/);
  const arrival = native.slice(native.indexOf('onArrival: () => {\n          if (!routeEpoch.isCurrent(routeToken)) return;'));
  assert.match(arrival.slice(0, 750), /routeEpoch\.runIfCurrent\(routeToken, \(\) => onCellSettledRef\.current\?\.\(to\)\)/);
  assert.ok(arrival.indexOf('routeEpoch.runIfCurrent(routeToken') < arrival.indexOf('onDone();'));
  assert.doesNotMatch(web, /NativeResidentRouteEpoch|runIfCurrent/);
});
