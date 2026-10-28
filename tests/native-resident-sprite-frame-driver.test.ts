import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  frameGroupStart,
  walkFrameFromElapsedMs,
  walkIndexInGroup,
  type WanderDirection
} from "../src/game/mapWandererMotion.ts";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";
import { NativeResidentSpriteFrameDriver } from "../src/performance/nativeResidentSpriteFrameDriver.ts";

function oracle(
  direction: WanderDirection,
  moving: boolean,
  elapsedMs: number,
  cellSizePx: number
): number {
  const frameIndex = frameGroupStart(direction) +
    walkIndexInGroup(direction, walkFrameFromElapsedMs(elapsedMs), moving);
  return frameIndex === 0 ? 0 : -frameIndex * cellSizePx;
}

test("all native sprite directions retain exact legacy sprite-sheet indices", () => {
  for (const direction of ["s", "n", "e", "w"] as const) {
    const writes: number[] = [];
    const driver = new NativeResidentSpriteFrameDriver(48, left => writes.push(left));
    driver.face(direction);
    assert.equal(driver.snapshot().offsetPx, oracle(direction, false, 0, 48));
    driver.setMoving(true);
    for (const elapsedMs of [0, 1, 179, 180, 359, 360, 539, 540, 900, 1080]) {
      driver.advanceElapsed(elapsedMs);
      assert.equal(driver.snapshot().offsetPx, oracle(direction, true, elapsedMs, 48));
    }
    driver.setMoving(false);
    assert.equal(driver.snapshot().offsetPx, oracle(direction, false, 0, 48));
    assert.equal(writes.at(-1) ?? 0, driver.snapshot().offsetPx);
    if (direction === "w") {
      assert.equal(driver.snapshot().offsetPx, -9 * 48,
        "west uses east frames mirrored by the existing React transform");
    }
  }
});

test("200 residents x 300 native RAF ticks: frames match reference without React state", () => {
  const population = 200;
  const ticks = 300;
  const size = 40;
  const writes = new Array<number>(population).fill(0);
  const lastOffset = new Array<number>(population).fill(0);
  const drivers = Array.from({ length: population }, (_, i) =>
    new NativeResidentSpriteFrameDriver(size, px => {
      writes[i]!++;
      lastOffset[i] = px;
    })
  );
  const directions = ["s", "e", "n", "w"] as const;
  drivers.forEach((driver, id) => {
    driver.face(directions[id % 4]!);
    driver.setMoving(true);
  });
  for (let tick = 0; tick < ticks; tick++) {
    const elapsed = tick * 16;
    for (let id = 0; id < population; id++) {
      drivers[id]!.advanceElapsed(elapsed);
      assert.equal(lastOffset[id], oracle(directions[id % 4]!, true, elapsed, size));
    }
  }
  const totalWrites = writes.reduce((sum, n) => sum + n, 0);
  assert.ok(totalWrites > 0);
  assert.ok(totalWrites < population * ticks / 5,
    "sprite image should be updated only when its 180ms frame changes");
  for (const driver of drivers) {
    const before = driver.snapshot().publishes;
    driver.advanceElapsed((ticks - 1) * 16);
    assert.equal(driver.snapshot().publishes, before, "same frame is a no-op");
    driver.setMoving(false);
    assert.equal(driver.snapshot().walkFrame, 0);
  }
});

test("speed 1x/2x/4x and background rebase preserve legacy frame selection", () => {
  const writes: number[] = [];
  const driver = new NativeResidentSpriteFrameDriver(52, x => writes.push(x));
  const segment = new NativeResidentSegmentProgress(0, 3000);
  driver.face("e");
  driver.setMoving(true);
  const samples = [
    { now: 16, speed: 1, resume: false },
    { now: 180, speed: 1, resume: false },
    { now: 360, speed: 2, resume: false },
    { now: 520, speed: 4, resume: false },
    { now: 30_000, speed: 4, resume: true },
    { now: 30_016, speed: 4, resume: false },
    { now: 30_032, speed: 2, resume: false }
  ];
  let previousOffset = driver.snapshot().offsetPx;
  for (const sample of samples) {
    const motion = segment.sample(sample.now, sample.speed, sample.resume);
    if (motion.advance) driver.advanceElapsed(motion.elapsedMs);
    assert.equal(driver.snapshot().offsetPx,
      oracle("e", true, motion.elapsedMs, 52));
    if (sample.resume) {
      assert.equal(driver.snapshot().offsetPx, previousOffset,
        "the first frame after background cannot jump sprite frames");
    }
    previousOffset = driver.snapshot().offsetPx;
  }
  driver.setMoving(false);
  assert.equal(driver.snapshot().offsetPx, oracle("e", false, 0, 52));
  assert.ok(writes.length < samples.length + 3);
});

test("commute segments reset animation phase but keep walking until final arrival", () => {
  const driver = new NativeResidentSpriteFrameDriver(64, () => {});
  driver.face("s");
  driver.setMoving(true);
  driver.advanceElapsed(375);
  assert.equal(driver.snapshot().walkFrame, 2);
  driver.face("n");
  driver.advanceElapsed(0);
  assert.equal(driver.snapshot().moving, true);
  assert.equal(driver.snapshot().offsetPx, -6 * 64);
  driver.advanceElapsed(181);
  assert.equal(driver.snapshot().offsetPx, -7 * 64);
  driver.setMoving(false);
  assert.equal(driver.snapshot().offsetPx, -6 * 64);
});

test("resizing and unmount-like remount preserve absolute pixels, no stale animation", () => {
  const writes: number[] = [];
  const driver = new NativeResidentSpriteFrameDriver(32, px => writes.push(px));
  driver.face("w");
  driver.setMoving(true);
  driver.advanceElapsed(190);
  assert.equal(driver.snapshot().offsetPx, -10 * 32);
  driver.setCellSize(60);
  assert.equal(driver.snapshot().offsetPx, -10 * 60);
  driver.setCellSize(60);
  assert.equal(writes.at(-1), -600);
  driver.setMoving(false);
  const fresh = new NativeResidentSpriteFrameDriver(60, () => {});
  assert.equal(fresh.snapshot().offsetPx, 0, "a remounted resident begins at south idle");
  assert.throws(() => new NativeResidentSpriteFrameDriver(0, () => {}));
  assert.throws(() => driver.setCellSize(Number.NaN));
  assert.throws(() => driver.setCellSize(Number.POSITIVE_INFINITY));
});

test("native-only Animated.Image wiring keeps web renderer and hit target separate", () => {
  const native = readFileSync("src/components/MapWandererCharacter.native.tsx", "utf8");
  const shared = readFileSync("src/components/MapWandererCharacter.tsx", "utf8");
  assert.match(native, /new NativeResidentSpriteFrameDriver\(/);
  assert.match(native, /<Animated\.Image/);
  assert.match(native, /left: spriteSheetOffset/);
  assert.match(native, /<AnimatedPressable/);
  assert.match(native, /\.\.\.pixelPos\.getLayout\(\)/);
  assert.doesNotMatch(native, /setWalkFrame\(|setIsMoving\(/);
  assert.doesNotMatch(shared, /NativeResidentSpriteFrameDriver|spriteSheetOffset/);
});
