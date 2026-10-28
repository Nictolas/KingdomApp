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

test("a resident walks at the active 1x, 2x and 4x simulation speed", () => {
  const clock = new PauseAwareMotionClock(0);
  assert.equal(clock.advanceScaled(100, 1), 100, "one real 100ms interval at 1x");
  assert.equal(clock.advanceScaled(200, 2), 300, "one interval at 2x");
  assert.equal(clock.advanceScaled(300, 4), 700, "one interval at 4x");
  assert.equal(clock.advanceScaled(400, 0), 700, "pause holds the same position");
  assert.equal(clock.advanceScaled(500, 1), 800, "resume at 1x, no catch-up");
});

test("a mid-step speed change accumulates time instead of resetting progress", () => {
  const clock = new PauseAwareMotionClock(1000);
  assert.equal(clock.advanceScaled(1200, 1), 200);
  assert.equal(clock.advanceScaled(1350, 4), 800);
  assert.equal(clock.advanceScaled(1400, 2), 900);
  assert.equal(clock.advanceScaled(1450, 2), 1000, "a 1-second tile is reached after integrated sim time");
});

test("invalid or backward speed samples never move the character backwards", () => {
  const clock = new PauseAwareMotionClock(100);
  assert.equal(clock.advanceScaled(110, Number.NaN), 0);
  assert.equal(clock.advanceScaled(120, -4), 0);
  assert.equal(clock.advanceScaled(115, 4), 0);
  assert.equal(clock.advanceScaled(130, 4), 40);
  assert.equal(clock.advanceScaled(Number.POSITIVE_INFINITY, 4), 40);
});

test("long RAF suspension does not teleport a walking resident on app resume", () => {
  const clock = new PauseAwareMotionClock(0);
  assert.equal(clock.advanceScaled(100, 1), 100);
  assert.equal(clock.advanceScaled(30_000, 4), 100, "backgrounded interval is discarded");
  assert.equal(clock.advanceScaled(30_016, 4), 164, "first visible frame resumes at active 4x");
});

test("a normal frame stall below background threshold still respects game speed", () => {
  const clock = new PauseAwareMotionClock(0);
  assert.equal(clock.advanceScaled(1999, 1), 1999);
  assert.equal(clock.advanceScaled(3999, 2), 1999, "exactly 2s is a suspended interval");
  assert.equal(clock.advanceScaled(4015, 2), 2031);
});
