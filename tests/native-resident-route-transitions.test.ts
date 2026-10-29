import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  nativeResidentRouteMode,
  nativeResidentHomeTransition,
  nativeResidentShouldRearmIdle
} from "../src/performance/nativeResidentRouteTransitions.ts";

test("commute always takes priority over fixed home, even when both change together", () => {
  const path = [10, 11, 12];
  assert.equal(nativeResidentRouteMode(path, 10), "commute");
  assert.equal(nativeResidentRouteMode(path, null), "commute");
  assert.equal(nativeResidentRouteMode(null, 10), "fixed");
  assert.equal(nativeResidentRouteMode([], 10), "fixed");
  assert.equal(nativeResidentRouteMode([10], null), "free");
  assert.equal(nativeResidentRouteMode(null, null), "free");
});

test("home exit is consumed once and cannot teleport a completed commute", () => {
  const night = nativeResidentHomeTransition(null, "fixed", 73);
  assert.deepEqual(night, { nextHome: 73, wakeCell: null });
  const morning = nativeResidentHomeTransition(night.nextHome, "free", null);
  assert.deepEqual(morning, { nextHome: null, wakeCell: 73 });
  assert.deepEqual(nativeResidentHomeTransition(morning.nextHome, "free", null),
    { nextHome: null, wakeCell: null });
  const commute = nativeResidentHomeTransition(73, "commute", null);
  assert.deepEqual(commute, { nextHome: null, wakeCell: null });
  assert.deepEqual(nativeResidentHomeTransition(commute.nextHome, "free", null),
    { nextHome: null, wakeCell: null });
  assert.deepEqual(nativeResidentHomeTransition(73, "commute", 73),
    { nextHome: null, wakeCell: null });
});

test("idle restarts after route completion, but not during commute, night or disabled roaming", () => {
  assert.equal(nativeResidentShouldRearmIdle("commute", "free", false, false), true);
  assert.equal(nativeResidentShouldRearmIdle("commute", "free", false, true), false);
  assert.equal(nativeResidentShouldRearmIdle("commute", "fixed", false, false), false);
  assert.equal(nativeResidentShouldRearmIdle("free", "commute", false, false), false);
  assert.equal(nativeResidentShouldRearmIdle("free", "free", true, false), true);
  assert.equal(nativeResidentShouldRearmIdle("free", "free", false, false), false);
  assert.equal(nativeResidentShouldRearmIdle("fixed", "free", false, false), false);
});

test("200 residents, 200 cycles: commute/night/free priority and no stale home wake", () => {
  const homes = Array.from({ length: 200 }, (_, i) => i * 2);
  const remembered = Array<number | null>(200).fill(null);
  let wakes = 0;
  let phantomWakes = 0;
  for (let cycle = 0; cycle < 200; cycle++) {
    for (let i = 0; i < 200; i++) {
      const home = homes[i]!;
      const night = nativeResidentHomeTransition(remembered[i], nativeResidentRouteMode(null, home), home);
      remembered[i] = night.nextHome;
      const commute = nativeResidentHomeTransition(remembered[i], nativeResidentRouteMode([home, home + 1], home), home);
      remembered[i] = commute.nextHome;
      const end = nativeResidentHomeTransition(remembered[i], nativeResidentRouteMode(null, null), null);
      remembered[i] = end.nextHome;
      if (end.wakeCell !== null) phantomWakes++;
      const nextNight = nativeResidentHomeTransition(remembered[i], "fixed", home);
      const normalWake = nativeResidentHomeTransition(nextNight.nextHome, "free", null);
      if (normalWake.wakeCell === home) wakes++;
      remembered[i] = normalWake.nextHome;
    }
  }
  assert.equal(phantomWakes, 0);
  assert.equal(wakes, 40_000);
  assert.ok(remembered.every(home => home === null));
});

test("native renderer uses route priority in both fixed and wake effects; web untouched", () => {
  const source = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  assert.match(source, /nativeResidentRouteMode\(commutePath, fixedCell\)/);
  assert.match(source, /if \(routeMode !== "fixed" \|\| fixedCell == null\) return;/);
  assert.match(source, /nativeResidentHomeTransition\(prevFixedCellRef\.current, routeMode, fixedCell\)/);
  assert.match(source, /nativeResidentShouldRearmIdle\(/);
  const commuteReset = source.slice(source.indexOf("    const previousCell = cellRef.current;"), source.indexOf("    const path = commutePath;"));
  assert.match(commuteReset, /stopAndReconcile\(\)/);
  assert.match(source, /const stopAndReconcile = useCallback\(\(\) => \{/);
  assert.match(source, /nativeResidentReconcileInterruptedClaim\(\s*cellRef\.current/);
  const home = source.slice(source.indexOf("/** Di notte"), source.indexOf("/** Fine notte"));
  assert.match(home, /motion\.stop\(\)/);
  assert.doesNotMatch(home, /motion\.cancel\(\)/);
  const wake = source.slice(source.indexOf("/** Fine notte"), source.indexOf("/** Removing a completed commute"));
  assert.match(wake, /motion\.stop\(\)/);
  assert.doesNotMatch(wake, /motion\.cancel\(\)/);
  const commuteCleanup = source.slice(source.indexOf("      alive = false;"));
  assert.match(commuteCleanup, /nativeResidentRunCleanup\\(\\s*\\(\\) => pendingCommuteRetry\\.clear\\(\\),\\s*stopAndReconcile,\\s*clearIdle\\s*\\)/);
  assert.doesNotMatch(commuteCleanup.slice(0, 220), /motion\.cancel\(\)/);
  assert.match(source, /if \(wakeTimer\.pending \|\| isMovingRef\.current\) return;/);
  assert.match(source, /if \(!isNativeResidentFrameBusActive\(\) \|\| getOrologioGiocoInPausaSnapshot\(\)\) return;/);
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(web, /nativeResidentRouteTransitions/);
});
