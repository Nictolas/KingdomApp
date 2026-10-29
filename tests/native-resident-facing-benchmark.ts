import assert from "node:assert/strict";
import { NativeResidentSpriteFrameDriver } from "../src/performance/nativeResidentSpriteFrameDriver.ts";

/**
 * Deterministic Node workload, not React Native execution or physical FPS.
 * Old facing state committed a React update whenever the direction changed.
 * New facing publishes only an Animated.Value when west/non-west flips.
 */
const directions = ["s", "e", "n", "w"] as const;
for (const speed of [1, 2, 4]) {
  let legacyDirectionChanges = 0;
  let mirrorWrites = 0;
  let frameWrites = 0;
  const lastDirection = Array<typeof directions[number]>(200).fill("s");
  const drivers = Array.from({ length: 200 }, () =>
    new NativeResidentSpriteFrameDriver(
      40,
      () => { frameWrites++; },
      () => { mirrorWrites++; }
    )
  );
  for (let tick = 0; tick < 1200; tick++) {
    for (let resident = 0; resident < 200; resident++) {
      const direction = directions[(resident + tick * speed) % 4]!;
      if (lastDirection[resident] !== direction) legacyDirectionChanges++;
      lastDirection[resident] = direction;
      const driver = drivers[resident]!;
      driver.face(direction);
      driver.setMoving(true);
      driver.advanceElapsed(tick * 16 * speed);
      assert.equal(driver.snapshot().mirrorScaleX, direction === "w" ? -1 : 1);
    }
  }
  const actualWrites = drivers.reduce((sum, driver) => sum + driver.snapshot().mirrorPublishes, 0);
  assert.equal(actualWrites, mirrorWrites);
  assert.ok(mirrorWrites <= legacyDirectionChanges);
  console.log(JSON.stringify({
    model: "synthetic_native_facing_no_device_fps",
    speed, residents: 200, turnsPerResident: 1200,
    legacyDirectionReactStateUpdates: legacyDirectionChanges,
    candidateDirectionReactStateUpdates: 0,
    candidateAnimatedMirrorWrites: mirrorWrites,
    candidateAnimatedSpriteOffsetWrites: frameWrites
  }));
}
