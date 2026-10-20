import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  frameGroupStart,
  segmentMoveDurationMs,
  walkFrameFromElapsedMs,
  walkIndexInGroup,
  WALK_FRAME_INTERVAL_MS,
  MOVE_DURATION_MS,
  MOVE_DURATION_ROAD_MS,
  type WanderDirection
} from "../src/game/mapWandererMotion.ts";

test("la camminata in orizzontale non usa mai i frame rivolti verso l'alto", () => {
  assert.equal(frameGroupStart("s"), 0);
  assert.equal(frameGroupStart("n"), 6);
  assert.equal(frameGroupStart("e"), 9);
  assert.equal(frameGroupStart("w"), 9);
  for (const direction of ["e", "w"] as const) {
    for (let frame = 0; frame < 30; frame++) {
      const imageIndex = frameGroupStart(direction) + walkIndexInGroup(direction, frame, true);
      assert.ok(imageIndex >= 9 && imageIndex <= 11, `${direction} used sprite ${imageIndex}`);
    }
    assert.equal(walkIndexInGroup(direction, 0, false), 0);
  }
});

test("il ciclo di camminata ha la stessa direzione a est e a ovest (sprite specchiato)", () => {
  for (let frame = 0; frame < 12; frame++) {
    assert.equal(walkIndexInGroup("e", frame, true), walkIndexInGroup("w", frame, true));
  }
});

test("la velocità sulle strade resta maggiore ma gli abitanti non scattano da cella a cella", () => {
  assert.equal(segmentMoveDurationMs(1, 2), MOVE_DURATION_MS);
  assert.equal(segmentMoveDurationMs(1, 2, (c) => c === 2), MOVE_DURATION_ROAD_MS);
  assert.ok(MOVE_DURATION_MS >= 900);
  assert.ok(MOVE_DURATION_ROAD_MS >= 650);
  assert.ok(MOVE_DURATION_MS > MOVE_DURATION_ROAD_MS);
});

test("la cadenza dei tre frame è stabile nel tempo e non dipende dalla durata della casella", () => {
  assert.equal(walkFrameFromElapsedMs(0), 0);
  assert.equal(walkFrameFromElapsedMs(WALK_FRAME_INTERVAL_MS - 1), 0);
  assert.equal(walkFrameFromElapsedMs(WALK_FRAME_INTERVAL_MS), 1);
  assert.equal(walkFrameFromElapsedMs(WALK_FRAME_INTERVAL_MS * 2), 2);
  assert.equal(walkFrameFromElapsedMs(WALK_FRAME_INTERVAL_MS * 3), 0);
  assert.equal(walkFrameFromElapsedMs(Number.NaN), 0);
});

test("tutti i movimenti (girovago e tragitto programmato) usano la stessa cadenza", () => {
  const code = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.equal((code.match(/setWalkFrame\(walkFrameFromElapsedMs\(now - start\)\)/g) ?? []).length, 2);
  assert.doesNotMatch(code, /walkFrameFromLinearMoveT/);
});
