import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentTapRecognizer,
  NATIVE_RESIDENT_DOUBLE_TAP_MS
} from "../src/performance/nativeResidentTapRecognizer.ts";
import { NativeResidentCallbackRelay } from "../src/performance/nativeResidentCallbackRelay.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

function ready() {
  const r = new NativeResidentTapRecognizer();
  r.setEligibleForDoubleTap(true);
  return r;
}

test("native double-tap retains the original 400ms strict threshold and immediate first tap", () => {
  const r = ready();
  assert.equal(NATIVE_RESIDENT_DOUBLE_TAP_MS, 400);
  assert.equal(r.press(1000), "single");
  assert.equal(r.press(1399.999), "double");
  assert.equal(r.press(1400), "single", "a third tap arms a new pair");
  assert.equal(r.press(1800), "single", "exactly 400ms is not double");
  assert.equal(r.press(2199.999), "double");
  assert.equal(r.press(2200), "single");
  assert.equal(r.press(2500), "double");
});

test("monotonic timestamp supports time 0 and rejects backward, invalid and stale samples", () => {
  const r = ready();
  assert.equal(r.press(0), "single");
  assert.equal(r.press(399), "double", "zero is a valid first timestamp");
  assert.equal(r.press(500), "single");
  assert.equal(r.press(400), "single", "clock regression cannot trigger double");
  assert.equal(r.press(401), "double", "regressed clock starts a new pair");
  assert.equal(r.press(Number.NaN), "single");
  assert.equal(r.press(600), "single", "NaN must reset the armed pair");
  assert.equal(r.press(Infinity), "single");
  assert.equal(r.press(601), "single");
  assert.equal(r.press(-Infinity), "single");
  assert.equal(r.press(602), "single");
  assert.equal(r.press(700), "double");
});

test("eligibility changes clear half gestures while retaining the same behavior when unchanged", () => {
  const r = new NativeResidentTapRecognizer();
  assert.equal(r.press(100), "single", "no double handler means single only");
  assert.equal(r.press(101), "single");
  r.setEligibleForDoubleTap(true);
  assert.equal(r.press(102), "single");
  r.setEligibleForDoubleTap(true); // unrelated React parent render
  assert.equal(r.press(103), "double", "unchanged eligibility must retain tap state");
  assert.equal(r.press(104), "single");
  r.setEligibleForDoubleTap(false); // touch passes to underlying footprint
  assert.equal(r.press(105), "single");
  r.setEligibleForDoubleTap(true);
  assert.equal(r.press(106), "single", "tap must not pair through passthrough transition");
  assert.equal(r.press(107), "double");
});

test("background, foreground and manual pause cancel partial taps without a 400ms catchup", () => {
  const r = ready();
  assert.equal(r.press(100), "single");
  r.reset(); // background
  assert.equal(r.press(120), "single", "background+resume cannot form a double tap");
  r.reset(); // game pause
  assert.equal(r.press(125), "single");
  r.reset(); // unmount
  assert.equal(r.press(126), "single");
  assert.equal(r.press(127), "double");
});

test("single-tap-only and double-tap-only configurations preserve existing dispatch rules", () => {
  let singles = 0;
  let doubles = 0;
  const r = new NativeResidentTapRecognizer();
  const dispatch = (at: number, singleHandler: boolean, doubleHandler: boolean) => {
    r.setEligibleForDoubleTap(doubleHandler);
    const kind = doubleHandler ? r.press(at) : (r.reset(), "single");
    if (kind === "double") doubles++;
    else if (singleHandler) singles++;
  };
  dispatch(100, true, false);
  dispatch(101, true, false);
  assert.equal(singles, 2);
  dispatch(102, true, true);
  dispatch(103, true, true);
  assert.equal(singles, 3, "first tap selects immediately");
  assert.equal(doubles, 1, "second tap opens details instead of selecting");
  dispatch(104, false, true);
  dispatch(105, false, true);
  assert.equal(doubles, 2, "double-only first tap arms, second opens");
  assert.equal(singles, 3);
  dispatch(106, true, false);
  assert.equal(singles, 4, "removing double handler cannot leave a phantom pair");
});

test("200 residents: taps never pair across residents, including boundary timestamps", () => {
  const residents = Array.from({ length: 200 }, () => ready());
  for (const resident of residents) {
    assert.equal(resident.press(1000), "single");
  }
  for (let index = 0; index < 200; index++) {
    assert.equal(residents[index]!.press(1100 + index), "double");
    assert.equal(residents[index]!.press(1200 + index), "single");
  }
  assert.equal(residents[0]!.press(1600), "single", "the 400ms boundary remains strict");
  assert.equal(residents[1]!.press(1599), "double", "different residents have independent pairs");
  assert.equal(residents[2]!.press(1600), "double");
});

test("200 residents, 40 lifecycle transitions: canceled touches never resurrect on resume", () => {
  const residents = Array.from({ length: 200 }, () => ready());
  const frameBus = new NativeResidentFrameBus(() => 1, () => {});
  const unsubscribe = residents.map(r => frameBus.subscribeActivity(active => {
    if (!active) r.reset();
  }));
  let singles = 0;
  let doubles = 0;
  for (let cycle = 0; cycle < 40; cycle++) {
    for (const r of residents) {
      if (r.press(cycle * 1000) === "single") singles++;
    }
    frameBus.setActive(false);
    frameBus.setActive(true);
    for (const r of residents) {
      if (r.press(cycle * 1000 + 10) === "single") singles++;
    }
    for (const r of residents) {
      if (r.press(cycle * 1000 + 11) === "double") doubles++;
    }
  }
  assert.equal(singles, 200 * 40 * 2);
  assert.equal(doubles, 200 * 40);
  assert.equal(frameBus.snapshot().activityListeners, 200);
  unsubscribe.forEach(stop => stop());
  assert.equal(frameBus.snapshot().activityListeners, 0);
});

test("cached event relay dispatches the latest committed handlers on second tap", () => {
  const calls: string[] = [];
  const relay = new NativeResidentCallbackRelay({
    onPress: () => calls.push("first"),
    onDoublePress: () => calls.push("old-double")
  });
  const r = ready();
  const bound = relay.bound();
  const dispatch = (at: number) => {
    const choice = r.press(at);
    if (choice === "double") bound.onDoublePress?.();
    else bound.onPress?.();
  };
  dispatch(1000);
  // Simulates 200 game ticks: closures update only after the React commit,
  // while handlers and tap recognizer remain stable within the resident.
  for (let i = 0; i < 200; i++) {
    relay.update({
      onPress: () => calls.push("press:" + i),
      onDoublePress: () => calls.push("double:" + i)
    });
    assert.strictEqual(relay.bound(), bound);
  }
  dispatch(1100);
  assert.deepEqual(calls, ["first", "double:199"]);
});

test("10,000 timestamped taps across 200 residents remain timer-free and O(1)", () => {
  const residents = Array.from({ length: 200 }, () => ready());
  let singles = 0;
  let doubles = 0;
  for (let round = 0; round < 50; round++) {
    const base = round * 1000;
    for (let id = 0; id < 200; id++) {
      const choice = residents[id]!.press(base + id / 200);
      if (choice === "single") singles++; else doubles++;
    }
    if (round % 2 === 0) {
      for (const r of residents) r.reset();
    }
  }
  assert.equal(singles, 10_000);
  assert.equal(doubles, 0);
  for (const r of residents) {
    assert.equal(r.press(50_000), "single");
    assert.equal(r.press(50_250), "double");
  }
});

test("native-only boundary: web hit-test semantics stay untouched", async () => {
  const { readFileSync } = await import("node:fs");
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(native, /NativeResidentTapRecognizer/);
  assert.match(native, /tapRecognizer\.press\(performance\.now\(\)\)/);
  assert.match(native, /tapRecognizer\.reset\(\)/);
  assert.match(native, /setEligibleForDoubleTap\(intercettaTocco && !!onDoublePress\)/);
  assert.doesNotMatch(native, /Date\.now\(\)/);
  assert.doesNotMatch(web, /NativeResidentTapRecognizer/);
  assert.match(web, /const DOPPIO_TAP_MS = 400/);
});
