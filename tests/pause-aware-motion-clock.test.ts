import assert from "node:assert/strict";
import test from "node:test";
import { PauseAwareMotionClock } from "../src/game/pauseAwareMotionClock.ts";

test("movement time excludes a long gameplay pause instead of teleporting", () => {
  const clock = new PauseAwareMotionClock(1_000);
  assert.equal(clock.advance(1_100, false), 100);
  assert.equal(clock.advance(1_200, false), 200);
  assert.equal(clock.advance(2_000, true), 200);
  assert.equal(clock.advance(10_000, true), 200);
  assert.equal(clock.advance(10_016, false), 216);
  assert.equal(clock.advance(10_100, false), 300);
});

test("clock ignores out-of-order and invalid timestamps", () => {
  const clock = new PauseAwareMotionClock(500);
  assert.equal(clock.advance(530, false), 30);
  assert.equal(clock.advance(520, false), 30);
  assert.equal(clock.advance(Number.NaN, false), 30);
  assert.equal(clock.advance(Number.POSITIVE_INFINITY, false), 30);
  assert.equal(clock.advance(560, false), 60);
  assert.throws(() => new PauseAwareMotionClock(Number.NaN));
});

test("idle and commute segments use independent elapsed clocks", () => {
  const idle = new PauseAwareMotionClock(0);
  const commute = new PauseAwareMotionClock(30);
  assert.equal(idle.advance(50, false), 50);
  assert.equal(commute.advance(50, false), 20);
  idle.advance(1000, true);
  assert.equal(idle.advance(1010, false), 60);
  assert.equal(commute.advance(1010, false), 980);
});
