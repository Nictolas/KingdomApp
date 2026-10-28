import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  NativeResidentCallbackRelay,
  type NativeResidentLiveCallbacks
} from "../src/performance/nativeResidentCallbackRelay.ts";

/**
 * Pure Node allocation-accounting benchmark, not React Native FPS, bridge
 * throughput, device memory, garbage collector timing or touch latency.
 *
 * Both paths update the same stable callback targets; the reference builds
 * a disposable bound-props object every render, as the previous relay did.
 */
const RESIDENTS = 200;
const RENDERS = 1000;

function run(useCachedRelay: boolean) {
  let checksum = 0;
  let createdBindings = 0;
  const relays = Array.from({ length: RESIDENTS }, () => new NativeResidentCallbackRelay({}));
  const prior: Array<NativeResidentLiveCallbacks | null> = Array(RESIDENTS).fill(null);
  const started = performance.now();

  for (let render = 0; render < RENDERS; render++) {
    // Two common masks: interactive with occupancy callbacks or empty
    // (e.g. passthrough). Mask changes should produce at most 2 cached
    // bindings per resident, even after 1000 parent clock renders.
    const active = render % 5 !== 0;
    for (let resident = 0; resident < RESIDENTS; resident++) {
      const props: NativeResidentLiveCallbacks = active
        ? {
            onPress: () => { checksum++; },
            onCellSettled: cell => { checksum += cell; },
            isCellFreeForMe: () => true,
            tryClaimCell: () => true,
            releaseMyCell: () => { checksum++; }
          }
        : {};
      relays[resident]!.update(props);
      let bound: NativeResidentLiveCallbacks;
      if (useCachedRelay) {
        bound = relays[resident]!.bound(props);
      } else {
        // Prior behavior: one fresh eight-property object on every render.
        const relayed = relays[resident]!;
        bound = {
          onPress: props.onPress ? relayed.onPress : undefined,
          onDoublePress: props.onDoublePress ? relayed.onDoublePress : undefined,
          onCommuteComplete: props.onCommuteComplete ? relayed.onCommuteComplete : undefined,
          onCommuteBlocked: props.onCommuteBlocked ? relayed.onCommuteBlocked : undefined,
          onCellSettled: props.onCellSettled ? relayed.onCellSettled : undefined,
          isCellFreeForMe: props.isCellFreeForMe ? relayed.isCellFreeForMe : undefined,
          tryClaimCell: props.tryClaimCell ? relayed.tryClaimCell : undefined,
          releaseMyCell: props.releaseMyCell ? relayed.releaseMyCell : undefined
        };
        createdBindings++;
      }
      const previous = prior[resident];
      if (useCachedRelay && previous !== null &&
        previous.onPress === bound.onPress && previous.releaseMyCell === bound.releaseMyCell) {
        assert.strictEqual(bound, previous, "same optional presence must not allocate a new binding");
      }
      if (useCachedRelay && previous !== bound) createdBindings++;
      prior[resident] = bound;
      if (active && render === RENDERS - 1) {
        bound.onPress?.();
        bound.onCellSettled?.(2);
        assert.equal(bound.isCellFreeForMe?.(resident), true);
        assert.equal(bound.tryClaimCell?.(resident), true);
        bound.releaseMyCell?.();
      }
    }
  }
  const elapsedMs = performance.now() - started;
  // The initial active=false mask and active=true mask each appear at least
  // once. Using identity changes per loop counts transitions, not uniques.
  const totalUniqueCached = useCachedRelay
    ? relays.reduce((total, relay) => total +
      (relay as unknown as { bindingByPresence: Array<NativeResidentLiveCallbacks | undefined> })
        .bindingByPresence.filter(Boolean).length, 0)
    : createdBindings;
  return {
    mode: useCachedRelay ? "cached_presence" : "new_object_per_render",
    jsElapsedMs: Number(elapsedMs.toFixed(3)),
    renders: RENDERS,
    residents: RESIDENTS,
    createdBindings: totalUniqueCached,
    checksum
  };
}


const reference = run(false);
const optimized = run(true);
assert.equal(reference.checksum, optimized.checksum);
assert.equal(reference.createdBindings, RESIDENTS * RENDERS);
assert.equal(optimized.createdBindings, RESIDENTS * 2);
console.log(JSON.stringify({
  kind: "node_synthetic_native_resident_relay_binding_churn_not_device_fps",
  reference, optimized,
  avoidedTransientBindings: reference.createdBindings - optimized.createdBindings,
  note: "Analytical JS binding-object counts, not direct GC, heap, touch or FPS measurements."
}));
