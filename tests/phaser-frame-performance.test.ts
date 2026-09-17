import assert from "node:assert/strict";
import test from "node:test";

import {
  PhaserFramePerformanceSampler,
  formatPhaserFramePerformance
} from "../src/phaser/adapters/phaserFramePerformance.ts";

test("frame performance sampler computes mean, p95 and slow-frame counts", () => {
  const sampler = new PhaserFramePerformanceSampler(10);
  for (const delta of [16, 16, 17, 18, 20, 34, 51, 16, 17, 18]) sampler.push(delta);

  const metrics = sampler.snapshot();
  assert.equal(metrics.sampleCount, 10);
  assert.equal(metrics.framesOver33Ms, 2);
  assert.equal(metrics.framesOver50Ms, 1);
  assert.equal(metrics.p95FrameMs, 51);
  assert.ok(metrics.meanFrameMs > 22 && metrics.meanFrameMs < 23);
  assert.ok(metrics.meanFps > 43 && metrics.meanFps < 45);
});

test("frame performance sampler keeps a bounded rolling window", () => {
  const sampler = new PhaserFramePerformanceSampler(3);
  sampler.push(10);
  sampler.push(20);
  sampler.push(30);
  sampler.push(40);

  const metrics = sampler.snapshot();
  assert.equal(metrics.sampleCount, 3);
  assert.equal(metrics.meanFrameMs, 30);
  assert.equal(metrics.p95FrameMs, 40);
});

test("invalid frame deltas are ignored and formatter stays readable", () => {
  const sampler = new PhaserFramePerformanceSampler();
  sampler.push(0);
  sampler.push(-1);
  sampler.push(Number.NaN);
  sampler.push(16.6667);

  const text = formatPhaserFramePerformance(sampler.snapshot());
  assert.match(text, /^FPS /);
  assert.match(text, /p95 /);
  assert.match(text, />33 /);
  assert.match(text, />50 /);
  assert.match(text, /n=1$/);
});
