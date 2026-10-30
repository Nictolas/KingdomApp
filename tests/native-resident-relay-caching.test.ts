import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentCallbackRelay,
  type NativeResidentLiveCallbacks
} from "../src/performance/nativeResidentCallbackRelay.ts";

function maskCallbacks(mask: number, observed: string[] = [], generation = 0): NativeResidentLiveCallbacks {
  return {
    onPress: mask & 1 ? () => observed.push("press:" + generation) : undefined,
    onDoublePress: mask & 2 ? () => observed.push("double:" + generation) : undefined,
    onCommuteComplete: mask & 4 ? purpose => observed.push("arrive:" + purpose + ":" + generation) : undefined,
    onCommuteBlocked: mask & 8 ? info => observed.push("blocked:" + info.blockedCell + ":" + generation) : undefined,
    onCellSettled: mask & 16 ? cell => observed.push("cell:" + cell + ":" + generation) : undefined,
    isCellFreeForMe: mask & 32 ? cell => cell === generation : undefined,
    tryClaimCell: mask & 64 ? cell => cell === generation + 1 : undefined,
    releaseMyCell: mask & 128 ? () => observed.push("release:" + generation) : undefined
  };
}

test("200 native residents, 1,000 clock updates: each stable handler presence creates one bound object", () => {
  const residents = 200;
  const updates = 1000;
  const observed = Array.from({ length: residents }, () => [] as string[]);
  const relays = Array.from({ length: residents }, (_, id) =>
    new NativeResidentCallbackRelay(maskCallbacks(255, observed[id]!, 0))
  );
  const bindings = relays.map(relay => relay.bound());
  assert.equal(new Set(bindings).size, residents, "no binding object can be shared between residents");
  for (let update = 1; update <= updates; update++) {
    for (let id = 0; id < residents; id++) {
      const relay = relays[id]!;
      // Updating parent callbacks does not publish any speculative render.
      const prospective = maskCallbacks(255, observed[id]!, update);
      assert.strictEqual(relay.bound(prospective), bindings[id], "binding object churn");
      relay.update(prospective);
      assert.strictEqual(relay.bound(), bindings[id], "committed binding object churn");
    }
  }
  for (let id = 0; id < residents; id++) {
    const bound = bindings[id]!;
    bound.onPress?.();
    bound.onDoublePress?.();
    bound.onCommuteComplete?.("home");
    bound.onCommuteBlocked?.({ fromCell: 1, blockedCell: 7, purpose: "work" });
    bound.onCellSettled?.(12);
    assert.equal(bound.isCellFreeForMe?.(updates), true);
    assert.equal(bound.tryClaimCell?.(updates + 1), true);
    bound.releaseMyCell?.();
    assert.deepEqual(observed[id], [
      "press:" + updates, "double:" + updates, "arrive:home:" + updates,
      "blocked:7:" + updates, "cell:12:" + updates, "release:" + updates
    ]);
    const internals = relays[id] as unknown as {
      bindingByPresence: Array<NativeResidentLiveCallbacks | undefined>;
    };
    assert.equal(internals.bindingByPresence.filter(Boolean).length, 1);
  }
});

test("all 256 optional-handler masks are cached independently and preserve exact presence", () => {
  const relay = new NativeResidentCallbackRelay({});
  const originals = Array.from({ length: 256 }, (_, mask) => relay.bound(maskCallbacks(mask)));
  assert.equal(new Set(originals).size, 256);
  const keys: Array<keyof NativeResidentLiveCallbacks> = [
    "onPress", "onDoublePress", "onCommuteComplete", "onCommuteBlocked",
    "onCellSettled", "isCellFreeForMe", "tryClaimCell", "releaseMyCell"
  ];
  for (let mask = 0; mask < 256; mask++) {
    const input = maskCallbacks(mask, [], 987);
    assert.strictEqual(relay.bound(input), originals[mask]);
    for (const [index, key] of keys.entries()) {
      assert.equal(typeof originals[mask]![key] === "function", Boolean(mask & (1 << index)),
        "presence mismatch for key " + key + " mask " + mask);
    }
  }
  const internals = relay as unknown as { bindingByPresence: Array<NativeResidentLiveCallbacks | undefined> };
  assert.equal(internals.bindingByPresence.length, 256);
  assert.equal(internals.bindingByPresence.filter(Boolean).length, 256);
});

test("200 residents flip between interactive and passthrough across 1,000 update cycles", () => {
  const count = 200;
  const relays = Array.from({ length: count }, () => new NativeResidentCallbackRelay({}));
  const seenMasks = Array.from({ length: count }, () => new Map<number, NativeResidentLiveCallbacks>());
  let pressed = 0;
  let released = 0;
  for (let cycle = 0; cycle < 1000; cycle++) {
    const mask = cycle % 3 === 0 ? 0 : cycle % 3 === 1 ? 1 : 129;
    for (let id = 0; id < count; id++) {
      const callbacks = {
        onPress: mask & 1 ? () => { pressed++; } : undefined,
        releaseMyCell: mask & 128 ? () => { released++; } : undefined
      };
      const relay = relays[id]!;
      const bound = relay.bound(callbacks);
      const previous = seenMasks[id]!.get(mask);
      if (previous) assert.strictEqual(bound, previous);
      else seenMasks[id]!.set(mask, bound);
      relay.update(callbacks);
      assert.strictEqual(relay.bound(), bound);
      if (mask === 0) {
        assert.equal(bound.onPress, undefined, "noninteractive sprite acquired hit target");
        assert.equal(bound.releaseMyCell, undefined, "unclaimed resident acquired release callback");
      } else {
        bound.onPress?.();
        bound.releaseMyCell?.();
      }
    }
  }
  const cyclesPress = Array.from({ length: 1000 }, (_, x) => x % 3 !== 0).filter(Boolean).length;
  const cyclesRelease = Array.from({ length: 1000 }, (_, x) => x % 3 === 2).filter(Boolean).length;
  assert.equal(pressed, cyclesPress * count);
  assert.equal(released, cyclesRelease * count);
  assert.ok(seenMasks.every(map => map.size === 3));
});

test("speculative rendering never publishes uncommitted closures even after cache hits", () => {
  const calls: string[] = [];
  const relay = new NativeResidentCallbackRelay({
    onPress: () => calls.push("committed"),
    onDoublePress: () => calls.push("committed-double")
  });
  const old = relay.bound();
  const speculative = {
    onPress: () => calls.push("aborted"),
    onDoublePress: () => calls.push("aborted-double"),
    releaseMyCell: () => calls.push("aborted-release")
  };
  const prospect = relay.bound(speculative);
  assert.notStrictEqual(prospect, old, "presence change must invalidate React.memo");
  prospect.onPress?.();
  prospect.onDoublePress?.();
  prospect.releaseMyCell?.();
  assert.deepEqual(calls, ["committed", "committed-double"]);
  assert.strictEqual(relay.bound(), old, "aborted rendering changed committed handler presence");
  const next = {
    onPress: () => calls.push("next"),
    onDoublePress: () => calls.push("next-double"),
    releaseMyCell: () => calls.push("next-release")
  };
  relay.update(next);
  assert.strictEqual(relay.bound(), prospect, "mask cache must match prospective binding on commit");
  old.onPress?.();
  prospect.onPress?.();
  prospect.releaseMyCell?.();
  assert.deepEqual(calls, [
    "committed", "committed-double", "next", "next", "next-release"
  ]);
});

test("relay retains only the eight event fields, not an entire resident props tree", () => {
  const path = Array.from({ length: 10000 }, (_, i) => i);
  const input = {
    onPress: () => {},
    isCellFreeForMe: () => true,
    commutePath: path,
    markerEmoji: "marker",
    fixedCell: 12,
    viewport: { largePayload: path },
    renderData: { nested: path }
  };
  const relay = new NativeResidentCallbackRelay(input);
  const internal = relay as unknown as { latest: Record<string, unknown> };
  assert.deepEqual(Object.keys(internal.latest).sort(), [
    "isCellFreeForMe", "onCellSettled", "onCommuteBlocked", "onCommuteComplete",
    "onDoublePress", "onPress", "releaseMyCell", "tryClaimCell"
  ].sort());
  assert.notStrictEqual(internal.latest, input);
  assert.ok(!Object.values(internal.latest).includes(path));
  for (let update = 0; update < 1000; update++) {
    const oldTarget = internal.latest;
    relay.update({ ...input, onPress: () => {} });
    assert.strictEqual(internal.latest, oldTarget, "new callback target object allocated per render");
  }
});

test("collision claim and arrival still call latest closures after 200 synchronous route replacements", () => {
  const relay = new NativeResidentCallbackRelay({
    tryClaimCell: () => false,
    onCellSettled: () => {},
    onCommuteComplete: () => {}
  });
  const bound = relay.bound();
  const arrivals: number[] = [];
  const claims: number[] = [];
  for (let generation = 0; generation < 200; generation++) {
    relay.update({
      tryClaimCell: cell => { claims.push(generation); return cell === generation; },
      onCellSettled: cell => { assert.equal(cell, generation); },
      onCommuteComplete: purpose => {
        assert.equal(purpose, "work");
        arrivals.push(generation);
      }
    });
    assert.strictEqual(relay.bound(), bound);
    assert.equal(bound.tryClaimCell?.(generation), true);
    bound.onCellSettled?.(generation);
    bound.onCommuteComplete?.("work");
  }
  assert.deepEqual(arrivals, Array.from({ length: 200 }, (_, i) => i));
  assert.deepEqual(claims, arrivals);
});
