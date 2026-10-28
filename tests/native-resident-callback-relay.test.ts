import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentCallbackRelay,
  type NativeResidentLiveCallbacks
} from "../src/performance/nativeResidentCallbackRelay.ts";

test("stable event functions call the latest parent closures after 500 world-clock renders", () => {
  const calls: string[] = [];
  const relay = new NativeResidentCallbackRelay({
    onPress: () => calls.push("old"),
    onCommuteComplete: () => calls.push("old-commute")
  });
  const initial = relay.bound();
  for (let tick = 0; tick < 500; tick++) {
    relay.update({
      onPress: () => calls.push("tap:" + tick),
      onCommuteComplete: (purpose) => calls.push(purpose + ":" + tick)
    });
    const current = relay.bound();
    assert.equal(current.onPress, initial.onPress);
    assert.equal(current.onCommuteComplete, initial.onCommuteComplete);
  }
  initial.onPress?.();
  initial.onCommuteComplete?.("work");
  assert.deepEqual(calls, ["tap:499", "work:499"]);
});

test("all eight event callbacks remain live and retain their exact arguments", () => {
  const calls: unknown[] = [];
  const relay = new NativeResidentCallbackRelay({
    onPress: () => calls.push("stale")
  });
  relay.update({
    onPress: () => calls.push("press"),
    onDoublePress: () => calls.push("double"),
    onCommuteComplete: (purpose) => calls.push(["complete", purpose]),
    onCommuteBlocked: (info) => calls.push(["blocked", info]),
    onCellSettled: (cell) => calls.push(["cell", cell]),
    isCellFreeForMe: (cell) => { calls.push(["free", cell]); return cell === 17; },
    tryClaimCell: (cell) => { calls.push(["claim", cell]); return cell === 19; },
    releaseMyCell: () => calls.push("release")
  });
  const bound = relay.bound();
  bound.onPress?.();
  bound.onDoublePress?.();
  bound.onCommuteComplete?.("cerca_lavoro");
  const blocked = { fromCell: 7, blockedCell: 9, purpose: "home" as const };
  bound.onCommuteBlocked?.(blocked);
  bound.onCellSettled?.(12);
  assert.equal(bound.isCellFreeForMe?.(17), true);
  assert.equal(bound.isCellFreeForMe?.(18), false);
  assert.equal(bound.tryClaimCell?.(19), true);
  assert.equal(bound.tryClaimCell?.(20), false);
  bound.releaseMyCell?.();
  assert.deepEqual(calls, [
    "press", "double", ["complete", "cerca_lavoro"], ["blocked", blocked],
    ["cell", 12], ["free", 17], ["free", 18],
    ["claim", 19], ["claim", 20], "release"
  ]);
});

test("optional event presence changes preserve non-interactive and non-claiming semantics", () => {
  const relay = new NativeResidentCallbackRelay({});
  let bound = relay.bound();
  for (const value of Object.values(bound)) assert.equal(value, undefined);
  relay.update({ onDoublePress: () => {}, isCellFreeForMe: () => false });
  bound = relay.bound();
  assert.equal(bound.onPress, undefined, "no phantom single-tap hit target");
  assert.equal(typeof bound.onDoublePress, "function");
  assert.equal(bound.tryClaimCell, undefined, "do not create occupancy claim when none existed");
  assert.equal(bound.isCellFreeForMe?.(1), false);
  const stableDouble = bound.onDoublePress;
  relay.update({ onDoublePress: () => {} });
  bound = relay.bound();
  assert.equal(bound.onDoublePress, stableDouble);
  assert.equal(bound.isCellFreeForMe, undefined);
  relay.update({});
  assert.equal(relay.bound().onDoublePress, undefined);
});

test("old event references do not retain stale game closures after reparenting", () => {
  let resident = 1;
  const relay = new NativeResidentCallbackRelay({
    onCellSettled: () => { throw new Error("old callback must never run"); }
  });
  const captured = relay.bound().onCellSettled!;
  relay.update({ onCellSettled: (cell) => { resident = cell; } });
  captured(23);
  assert.equal(resident, 23);
  relay.update({});
  captured(50); // A callback from an obsolete frame is harmless if no longer present.
  assert.equal(resident, 23);
});

test("callback exceptions are not swallowed or retried by the relay", () => {
  const relay = new NativeResidentCallbackRelay({
    onPress: () => { throw new Error("test failure"); }
  });
  assert.throws(() => relay.bound().onPress?.(), /test failure/);
});

test("200 residents, 300 parent renders: no stable callback identity churn", () => {
  const population = 200;
  const ticks = 300;
  const arrivals = new Array<number>(population).fill(-1);
  const relays = Array.from({ length: population }, (_, id) =>
    new NativeResidentCallbackRelay({
      onCellSettled: () => { arrivals[id] = -100; },
      tryClaimCell: () => false
    })
  );
  const stable = relays.map((relay) => relay.bound());
  for (let tick = 0; tick < ticks; tick++) {
    for (let id = 0; id < population; id++) {
      const latest: NativeResidentLiveCallbacks = {
        onCellSettled: (cell) => { arrivals[id] = cell + tick; },
        tryClaimCell: (cell) => cell === id + tick
      };
      relays[id]!.update(latest);
      const current = relays[id]!.bound();
      assert.equal(current.onCellSettled, stable[id]!.onCellSettled);
      assert.equal(current.tryClaimCell, stable[id]!.tryClaimCell);
    }
  }
  for (let id = 0; id < population; id++) {
    stable[id]!.onCellSettled?.(id);
    assert.equal(arrivals[id], id + ticks - 1);
    assert.equal(stable[id]!.tryClaimCell?.(id + ticks - 1), true);
    assert.equal(stable[id]!.tryClaimCell?.(id + ticks), false);
  }
});

test("non-event motion and touch-passthrough predicates are intentionally excluded", () => {
  const keys = Object.keys(new NativeResidentCallbackRelay({}).bound());
  assert.ok(!keys.includes("isWalkable"));
  assert.ok(!keys.includes("isRoadCell"));
  assert.ok(!keys.includes("passTouchesToMapOnCell"));
  assert.ok(!keys.includes("commutePath"));
  assert.ok(!keys.includes("fixedCell"));
  assert.ok(!keys.includes("markerEmoji"));
});
