import assert from "node:assert/strict";
import test from "node:test";
import {
  centerNativeMap,
  clampNativeMapScale,
  nativeMapAnimatedTranslation,
  nativePinchFocal,
  pinchNativeMap
} from "../src/game/nativeMapTransform.ts";

test("native camera centers a world larger than viewport with a negative offset", () => {
  assert.deepEqual(centerNativeMap({ width: 400, height: 800 }, { width: 2000, height: 2000 }, 1),
    { positionX: -800, positionY: -600, scale: 1 });
});

test("pan/pinch maintains the world point beneath the focal point", () => {
  const start = { positionX: -800, positionY: -600, scale: 1 };
  const initialFocal = { x: 220, y: 300 };
  const finalFocal = { x: 240, y: 340 };
  const result = pinchNativeMap(start, initialFocal, finalFocal, 2, 0.5, 3);
  assert.deepEqual(result, { positionX: -1800, positionY: -1460, scale: 2 });
  const originalWorldX = (initialFocal.x - start.positionX) / start.scale;
  const originalWorldY = (initialFocal.y - start.positionY) / start.scale;
  assert.equal((finalFocal.x - result.positionX) / result.scale, originalWorldX);
  assert.equal((finalFocal.y - result.positionY) / result.scale, originalWorldY);
});

test("minimum and maximum zoom clamp without losing focal position", () => {
  assert.equal(clampNativeMapScale(0.01, 0.5, 3), 0.5);
  assert.equal(clampNativeMapScale(20, 0.5, 3), 3);
  const result = pinchNativeMap({ positionX: 0, positionY: 0, scale: 1 },
    { x: 100, y: 100 }, { x: 100, y: 100 }, 20, 0.5, 3);
  assert.equal(result.scale, 3);
  assert.equal(result.positionX, -200);
});

test("translate compensates for React Native center-origin transforms", () => {
  const a = nativeMapAnimatedTranslation({ positionX: -800, positionY: -600, scale: 1 }, { width: 2000, height: 2000 });
  assert.deepEqual(a, { x: -800, y: -600 });
  const b = nativeMapAnimatedTranslation({ positionX: -1800, positionY: -1460, scale: 2 }, { width: 2000, height: 2000 });
  assert.deepEqual(b, { x: -800, y: -460 });
});

test("pinch uses a frozen viewport origin even after an async layout measurement changes", () => {
  const atStart = { x: 40, y: 80 };
  const firstTouches = [{ pageX: 140, pageY: 280 }, { pageX: 340, pageY: 280 }];
  const secondTouches = [{ pageX: 120, pageY: 280 }, { pageX: 360, pageY: 280 }];
  assert.deepEqual(nativePinchFocal(firstTouches, atStart), { x: 200, y: 200 });
  assert.deepEqual(nativePinchFocal(secondTouches, atStart), { x: 200, y: 200 });
  // The async native measure callback might report different values in the meantime.
  // Holding on to the original viewport offset prevents a false 10-point pan.
  assert.deepEqual(nativePinchFocal(secondTouches, { x: 50, y: 90 }), { x: 190, y: 190 });
  const start = { positionX: -800, positionY: -600, scale: 1 };
  const focalStart = nativePinchFocal(firstTouches, atStart)!;
  const focalNext = nativePinchFocal(secondTouches, atStart)!;
  const next = pinchNativeMap(start, focalStart, focalNext, 1.2, 0.5, 3);
  assert.deepEqual(next, { positionX: -1000, positionY: -760, scale: 1.2 });
  assert.equal(nativePinchFocal([], atStart), null);
  assert.equal(nativePinchFocal([{ pageX: 1, pageY: 2 }], atStart), null);
});
