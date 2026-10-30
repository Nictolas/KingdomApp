import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  getNativeRealFixtureCaptureBlockReason,
  createNativeRealFixtureResidents,
  createNativeRealFixtureCommutePath,
  NativeRealFixtureOccupancy,
  NativeRealFixtureSelection,
  NATIVE_REAL_FIXTURE_CELLS,
  NATIVE_REAL_FIXTURE_COLS,
  NATIVE_REAL_FIXTURE_ROWS
} from "../src/performance/nativeRealResidentFixture.ts";

test("25/50/100/200 actual native sprite fixtures are unique and fit 20x20 cells", () => {
  assert.equal(NATIVE_REAL_FIXTURE_COLS, 20);
  assert.equal(NATIVE_REAL_FIXTURE_ROWS, 20);
  assert.equal(NATIVE_REAL_FIXTURE_CELLS, 400);
  for (const count of [25, 50, 100, 200] as const) {
    const fixtures = createNativeRealFixtureResidents(count);
    assert.equal(fixtures.length, count);
    assert.equal(new Set(fixtures.map(x => x.instanceId)).size, count);
    assert.equal(new Set(fixtures.map(x => x.spawnCell)).size, count);
    assert.ok(fixtures.every(x => x.spawnCell >= 0 && x.spawnCell < NATIVE_REAL_FIXTURE_CELLS));
    assert.ok(fixtures.every(x => x.instanceId >= 10000));
    assert.deepEqual(fixtures, createNativeRealFixtureResidents(count));
  }
  assert.throws(() => createNativeRealFixtureResidents(201 as never), /Unsupported/);
});

test("deterministic two-cell commute lanes are disjoint, adjacent and reversible for all four populations", () => {
  for (const count of [25, 50, 100, 200] as const) {
    const residents = createNativeRealFixtureResidents(count);
    const endpoints = new Set<number>();
    for (const resident of residents) {
      const outward = createNativeRealFixtureCommutePath(resident);
      const inward = createNativeRealFixtureCommutePath(resident, true);
      assert.deepEqual(outward, [resident.spawnCell, resident.spawnCell + 1]);
      assert.deepEqual(inward, [outward[1], outward[0]]);
      assert.equal(Math.floor(outward[0]! / NATIVE_REAL_FIXTURE_COLS),
        Math.floor(outward[1]! / NATIVE_REAL_FIXTURE_COLS), "no row-wrap teleport");
      for (const cell of outward) {
        assert.ok(!endpoints.has(cell), "each resident must own an independent lane");
        endpoints.add(cell);
      }
    }
    assert.equal(endpoints.size, count * 2);
  }
  for (const invalid of [-1, 19, 399, 400, 2.5, Number.NaN]) {
    assert.throws(() => createNativeRealFixtureCommutePath({ instanceId: 1, spawnCell: invalid }),
      /Invalid native fixture commute lane/);
  }
});

test("200 deterministic commute sprites survive 240 alternating legs without occupancy collisions", () => {
  const residents = createNativeRealFixtureResidents(200);
  const occupancy = new NativeRealFixtureOccupancy();
  for (const resident of residents) {
    assert.equal(occupancy.tryClaim(resident.instanceId, resident.spawnCell), true);
  }
  for (let leg = 0; leg < 240; leg++) {
    for (const resident of residents) {
      const path = createNativeRealFixtureCommutePath(resident, leg % 2 === 1);
      assert.equal(occupancy.tryClaim(resident.instanceId, path[1]!), true);
    }
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
  }
  assert.equal(occupancy.snapshot().denied, 0);
  assert.equal(occupancy.snapshot().claims, 200 + 200 * 240);
  for (const resident of residents) occupancy.release(resident.instanceId);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(occupancy.checkInvariants(), true);
});

test("200 distinct occupants can spawn without modifying gameplay state or overlapping cells", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const fixtures = createNativeRealFixtureResidents(200);
  for (const resident of fixtures) {
    assert.equal(occupancy.isFreeFor(resident.instanceId, resident.spawnCell), true);
    assert.equal(occupancy.tryClaim(resident.instanceId, resident.spawnCell), true);
  }
  assert.equal(occupancy.snapshot().occupied, 200);
  assert.equal(occupancy.snapshot().claims, 200);
  assert.equal(occupancy.checkInvariants(), true);

  const a = fixtures[0]!;
  const b = fixtures[1]!;
  assert.equal(occupancy.isFreeFor(b.instanceId, a.spawnCell), false);
  assert.equal(occupancy.tryClaim(b.instanceId, a.spawnCell), false);
  assert.equal(occupancy.isFreeFor(b.instanceId, b.spawnCell), true,
    "failed claim cannot evict the original position");
  assert.equal(occupancy.snapshot().occupied, 200);
  assert.equal(occupancy.snapshot().denied, 1);
  assert.equal(occupancy.checkInvariants(), true);

  occupancy.release(a.instanceId);
  assert.equal(occupancy.snapshot().occupied, 199);
  assert.equal(occupancy.tryClaim(b.instanceId, a.spawnCell), true,
    "move atomically into released cell");
  assert.equal(occupancy.isFreeFor(a.instanceId, b.spawnCell), true,
    "successful claim must release previous cell");
  assert.equal(occupancy.snapshot().occupied, 199);
  assert.equal(occupancy.checkInvariants(), true);
});

test("invalid and out-of-bounds cells are always rejected, without mutating the fixture", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(10001, 0), true);
  for (const invalid of [-10, -1, 400, 100000, 0.5, Number.NaN, Infinity]) {
    assert.equal(occupancy.tryClaim(10001, invalid), false);
    assert.equal(occupancy.isFreeFor(10001, invalid), false);
    assert.equal(occupancy.snapshot().occupied, 1);
    assert.equal(occupancy.checkInvariants(), true);
  }
  assert.equal(occupancy.isFreeFor(10001, 0), true);
});

test("4000 seeded contention operations never create two owners for one cell", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const residents = createNativeRealFixtureResidents(200);
  for (const r of residents) occupancy.tryClaim(r.instanceId, r.spawnCell);
  let state = 20261028;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let step = 0; step < 4000; step++) {
    const resident = residents[Math.floor(random() * residents.length)]!;
    const target = Math.floor(random() * NATIVE_REAL_FIXTURE_CELLS);
    occupancy.tryClaim(resident.instanceId, target);
    if (step % 33 === 0) {
      assert.ok(occupancy.snapshot().occupied <= 200);
      assert.equal(occupancy.checkInvariants(), true);
    }
  }
  assert.ok(occupancy.snapshot().denied > 0, "stress must exercise collision denial");
  assert.equal(occupancy.snapshot().occupied, 200);
  assert.equal(occupancy.checkInvariants(), true);
  for (const r of residents) occupancy.release(r.instanceId);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(occupancy.checkInvariants(), true);
});

test("remount and teardown release all occupancy and preserve the independent next fixture", () => {
  const residents = createNativeRealFixtureResidents(200);
  const previous = new NativeRealFixtureOccupancy();
  for (const r of residents) previous.tryClaim(r.instanceId, r.spawnCell);
  const next = new NativeRealFixtureOccupancy();
  for (const r of residents) next.tryClaim(r.instanceId, r.spawnCell);
  for (const r of residents) previous.release(r.instanceId);
  assert.equal(previous.snapshot().occupied, 0);
  assert.equal(next.snapshot().occupied, 200, "old cleanup cannot erase new fixture ownership");
  for (const r of residents) next.release(r.instanceId);
  assert.equal(next.snapshot().occupied, 0);
});

test("source boundary uses the real native sprite component without altering GameContext or saves", () => {
  const screen = readFileSync(new URL("../app/native-perf.tsx", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../src/performance/NativeRealResidentWorkload.tsx", import.meta.url), "utf8");
  const occupancy = readFileSync(new URL("../src/performance/nativeRealResidentFixture.ts", import.meta.url), "utf8");
  assert.match(screen, /NativeRealResidentWorkload/);
  assert.match(screen, /Sprite abitanti reali/);
  assert.match(screen, /realRenderer \? \(/);
  assert.match(screen, /key=\{fixtureKey\}/, "remount after movement mode changes");
  assert.match(screen, /if \(!isMoving \|\| realRenderer\)/,
    "marker-only animation must stop when real resident renderer is selected");
  assert.match(fixture, /MapWandererCharacter/);
  assert.match(fixture, /NativeRealFixtureOccupancy/);
  assert.match(fixture, /disableIdleRoam=\{!moving \|\| deterministicCommute\}/);
  assert.match(fixture, /commutePath=\{commutePath\}/);
  assert.match(fixture, /onCommuteComplete=\{commutePath \? onCommuteComplete : undefined\}/);
  assert.match(screen, /Tragitto ripetibile/);
  assert.match(screen, /deterministicCommute=\{repeatable\}/);
  assert.match(screen, /Sprite abitanti reali in tragitto ripetibile/);
  assert.match(fixture, /const tryClaimCell = useCallback/);
  assert.match(fixture, /tryClaimCell=\{tryClaimCell\}/);
  assert.match(fixture, /const onSelect = useCallback/);
  assert.match(fixture, /onPress=\{onSelect\}/);
  assert.match(fixture, /onDoublePress=\{onSelect\}/);
  assert.match(fixture, /const NativeRealFixtureSprite = memo/);
  assert.match(fixture, /const NativeFixtureStatus = memo/);
  assert.match(fixture, /selection\.subscribe/);
  assert.doesNotMatch(fixture, /setSelected\(/,
    "touch feedback must not rerender all 200 native sprite wrappers");
  assert.match(fixture, /releaseMyCell=\{releaseMyCell\}/);
  assert.match(fixture, /timeScale === 0/);
  assert.match(fixture, /Simulazione in pausa/);
  assert.doesNotMatch(fixture, /\b(?:setOrologioGioco\w*|setOrologioSim\w*|restoreOrologio|patchMappaPersonaggiRuntime|fetch)\s*\(/);
  assert.doesNotMatch(fixture, /import[^\n]*(?:GameContext|AsyncStorage)/);
  assert.doesNotMatch(occupancy, /\b(?:patchMappaPersonaggiRuntime|fetch)\s*\(/);
  assert.doesNotMatch(occupancy, /import[^\n]*(?:GameContext|AsyncStorage)/);
  assert.match(screen, /!__DEV__ \|\| Platform\.OS === "web"/);
});

test("fixture occupancy callbacks match the real map's claim/release behavior", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const ids = [10001, 10002];
  assert.equal(occupancy.tryClaim(ids[0], 10), true);
  assert.equal(occupancy.tryClaim(ids[1], 11), true);
  assert.equal(occupancy.tryClaim(ids[0], 11), false);
  assert.equal(occupancy.tryClaim(ids[0], 12), true);
  assert.equal(occupancy.isFreeFor(ids[1], 10), true);
  occupancy.release(ids[0]);
  occupancy.release(ids[0]);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.tryClaim(ids[0], 11), false);
  occupancy.settledAt(ids[1], 11);
  assert.equal(occupancy.snapshot().settled, 1);
  assert.equal(occupancy.checkInvariants(), true);
});

test("touch selection notifies only the overlay, suppresses duplicate selection and unsubscribes", () => {
  const selection = new NativeRealFixtureSelection();
  const events: Array<number | null> = [];
  const unsubscribe = selection.subscribe(() => events.push(selection.getSnapshot()));
  assert.equal(selection.getSnapshot(), null);
  selection.select(10000);
  selection.select(10000);
  selection.select(10001);
  assert.deepEqual(events, [10000, 10001]);
  unsubscribe();
  selection.select(10002);
  assert.deepEqual(events, [10000, 10001]);
  assert.equal(selection.getSnapshot(), 10002);
});

test("200 native fixture tap targets, 200000 selections: stable subscriptions and isolated remount", () => {
  const fixtures = createNativeRealFixtureResidents(200);
  const selection = new NativeRealFixtureSelection();
  const next = new NativeRealFixtureSelection();
  let notified = 0;
  const unsubscribe = selection.subscribe(() => { notified++; });
  for (let i = 0; i < 200000; i++) {
    selection.select(fixtures[i % 200]!.instanceId);
    selection.select(fixtures[i % 200]!.instanceId);
  }
  assert.equal(notified, 200000);
  assert.equal(selection.getSnapshot(), fixtures[199]!.instanceId);
  assert.equal(next.getSnapshot(), null, "remounted fixture must not inherit old touch state");
  unsubscribe();
  selection.select(fixtures[0]!.instanceId);
  assert.equal(notified, 200000, "unmounted overlay must not receive stale updates");
});

test("A/B readiness signals only completion/invalidation, not 48,000 movement transfers", () => {
  const residents = createNativeRealFixtureResidents(200);
  const occupancy = new NativeRealFixtureOccupancy(200);
  const changes: boolean[] = [];
  const unsubscribe = occupancy.subscribeReady(() => changes.push(occupancy.getReadySnapshot()));
  assert.equal(occupancy.getReadySnapshot(), false);
  for (let i = 0; i < residents.length; i++) {
    const resident = residents[i]!;
    assert.equal(occupancy.tryClaim(resident.instanceId, resident.spawnCell), true);
    assert.equal(occupancy.getReadySnapshot(), i === 199);
  }
  assert.deepEqual(changes, [true], "199 intermediate claims must not rerender status");
  for (let leg = 0; leg < 240; leg++) {
    for (const resident of residents) {
      const path = createNativeRealFixtureCommutePath(resident, leg % 2 === 1);
      assert.equal(occupancy.tryClaim(resident.instanceId, path[1]!), true);
    }
    assert.equal(occupancy.getReadySnapshot(), true);
  }
  assert.deepEqual(changes, [true], "48,000 movements must not notify readiness listeners");
  occupancy.release(residents[0]!.instanceId);
  assert.equal(occupancy.getReadySnapshot(), false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(occupancy.tryClaim(residents[0]!.instanceId, residents[0]!.spawnCell), true);
  assert.deepEqual(changes, [true, false, true]);
  unsubscribe();
  occupancy.release(residents[0]!.instanceId);
  assert.deepEqual(changes, [true, false, true], "unmounted overlay cannot receive notifications");
  const remounted = new NativeRealFixtureOccupancy(200);
  assert.equal(remounted.getReadySnapshot(), false, "new scene cannot inherit previous readiness");
  assert.equal(remounted.checkInvariants(), true);
  for (const invalid of [-1, 401, 1.5, Number.NaN]) {
    assert.throws(() => new NativeRealFixtureOccupancy(invalid), /expected population/);
  }
});

test("readiness indicator uses a separate store, not 200 resident React state updates", () => {
  const workload = readFileSync(new URL("../src/performance/NativeRealResidentWorkload.tsx", import.meta.url), "utf8");
  assert.match(workload, /new NativeRealFixtureOccupancy\(population\)/);
  assert.match(workload, /occupancy\.subscribeReady/);
  assert.match(workload, /occupancy\.getReadySnapshot/);
  assert.match(workload, /Occupazione pronta:/);
  assert.match(workload, /Occupazione sprite non pronta:/);
  assert.doesNotMatch(workload, /import[^\n]*(?:GameContext|AsyncStorage)|\bfetch\s*\(/);
});

test("A/B capture gate rejects incomplete, unstable, paused and invalid real sprite scenes", () => {
  const base = { realRenderer: true, width: 320, height: 320, ready: true, settled: true, moving: true, timeScale: 1 };
  for (const scale of [1, 2, 4]) assert.equal(getNativeRealFixtureCaptureBlockReason({ ...base, timeScale: scale }), null);
  for (const [changes, reason] of [
    [{ ready: false }, /prenotino/], [{ settled: false }, /stabilizzazione/],
    [{ timeScale: 0 }, /Riprendi/], [{ timeScale: Number.NaN }, /Riprendi/],
    [{ width: 0 }, /geometria/], [{ height: -1 }, /geometria/],
    [{ width: Infinity }, /geometria/]
  ] as const) assert.match(getNativeRealFixtureCaptureBlockReason({ ...base, ...changes })!, reason);
  assert.equal(getNativeRealFixtureCaptureBlockReason({ ...base, moving: false, timeScale: 0 }), null);
  assert.equal(getNativeRealFixtureCaptureBlockReason({ ...base, realRenderer: false, ready: false, settled: false, timeScale: 0 }), null);
});
test("A/B readiness notifications remain bounded across 200 x 240 transfers", () => {
  for (const count of [25, 50, 100, 200] as const) {
    const occupancy = new NativeRealFixtureOccupancy(count);
    const residents = createNativeRealFixtureResidents(count);
    let transitions = 0;
    const off = occupancy.subscribeReady(() => transitions++);
    for (const r of residents) assert.equal(occupancy.tryClaim(r.instanceId, r.spawnCell), true);
    assert.equal(occupancy.getReadySnapshot(), true);
    assert.equal(transitions, 1);
    for (let round = 0; round < 240; round++)
      for (const r of residents)
        assert.equal(occupancy.tryClaim(r.instanceId, createNativeRealFixtureCommutePath(r, round % 2 === 1)[1]!), true);
    assert.equal(transitions, 1, "no per-movement HUD gate updates");
    occupancy.release(residents[0]!.instanceId);
    assert.equal(occupancy.getReadySnapshot(), false);
    assert.equal(transitions, 2);
    assert.equal(occupancy.tryClaim(residents[0]!.instanceId, residents[0]!.spawnCell), true);
    assert.equal(transitions, 3, "recovery starts a new stabilization epoch");
    off();
  }
});
test("A/B capture guard is wired to both HUD and fixture, without game-state writes", () => {
  const screen = readFileSync(new URL("../app/native-perf.tsx", import.meta.url), "utf8");
  const workload = readFileSync(new URL("../src/performance/NativeRealResidentWorkload.tsx", import.meta.url), "utf8");
  const hud = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  assert.ok(screen.includes("onReadinessChange={onReadinessChange}"));
  assert.ok(screen.includes("captureBlockedReason={captureBlockReason}"));
  assert.ok(screen.includes("captureContextKey={captureContextKey}"));
  assert.ok(screen.includes("setTimeout(() => setSettled"));
  assert.ok(workload.includes("occupancy.subscribeReady(notify)"));
  assert.ok(hud.includes("captureBlockedReason"));
  assert.ok(hud.includes("captureContextKey"));
  assert.ok(!screen.includes("setOrologioGiocoVelocita("));
});


test("A/B repeatable motion gate requires a completed REAL commute for every resident, not just spawn", () => {
  for (const count of [25, 50, 100, 200] as const) {
    const occupancy = new NativeRealFixtureOccupancy(count);
    const residents = createNativeRealFixtureResidents(count);
    let notifications = 0;
    const unsubscribe = occupancy.subscribeReady(() => notifications++);
    occupancy.markCommuteCompleted(residents[0]!.instanceId);
    assert.equal(occupancy.getCommuteReadySnapshot(), false);
    for (const resident of residents) assert.equal(occupancy.tryClaim(resident.instanceId, resident.spawnCell), true);
    assert.equal(occupancy.getReadySnapshot(), true);
    assert.equal(occupancy.getCaptureReadySnapshot(false), true, "random roam retains occupancy-only gate");
    assert.equal(occupancy.getCaptureReadySnapshot(true), false, "spawn is not motion proof");
    assert.equal(notifications, 1);
    for (const resident of residents.slice(0, -1)) {
      occupancy.markCommuteCompleted(resident.instanceId);
      occupancy.markCommuteCompleted(resident.instanceId);
      assert.equal(occupancy.getCaptureReadySnapshot(true), false);
    }
    assert.equal(notifications, 1, "individual arrivals must not rerender the HUD");
    occupancy.markCommuteCompleted(residents[count - 1]!.instanceId);
    assert.equal(occupancy.getCaptureReadySnapshot(true), true);
    assert.equal(notifications, 2, "one aggregate motion-ready transition");
    for (let leg = 0; leg < 240; leg++) {
      for (const resident of residents) {
        assert.equal(occupancy.tryClaim(resident.instanceId,
          createNativeRealFixtureCommutePath(resident, leg % 2 === 1)[1]!), true);
        occupancy.markCommuteCompleted(resident.instanceId);
      }
    }
    assert.equal(notifications, 2, "48,000 transfers must not trigger React readiness churn");
    assert.equal(occupancy.checkInvariants(), true);
    const first = residents[0]!;
    occupancy.release(first.instanceId);
    assert.equal(occupancy.getCaptureReadySnapshot(true), false);
    assert.equal(notifications, 3);
    assert.equal(occupancy.tryClaim(first.instanceId, first.spawnCell), true);
    assert.equal(occupancy.getCaptureReadySnapshot(false), true);
    assert.equal(occupancy.getCaptureReadySnapshot(true), false,
      "a reclaim must not inherit stale commute evidence");
    assert.equal(notifications, 4);
    occupancy.markCommuteCompleted(first.instanceId);
    assert.equal(occupancy.getCaptureReadySnapshot(true), true);
    assert.equal(notifications, 5);
    unsubscribe();
    for (const resident of residents) occupancy.release(resident.instanceId);
    assert.equal(occupancy.getReadySnapshot(), false);
    assert.equal(occupancy.getCommuteReadySnapshot(), false);
    assert.equal(notifications, 5);
  }
});

test("A/B first-commute gate is connected to the actual native arrival, not a synthetic timer", () => {
  const workload = readFileSync(new URL("../src/performance/NativeRealResidentWorkload.tsx", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../src/performance/nativeRealResidentFixture.ts", import.meta.url), "utf8");
  assert.match(workload, /occupancy\.markCommuteCompleted\(id\)/);
  assert.match(workload, /occupancy\.getCaptureReadySnapshot\(deterministicCommute && moving\)/);
  assert.match(workload, /onCommuteComplete=\{commutePath \? onCommuteComplete : undefined\}/);
  assert.match(fixture, /completedCommutes\.delete\(residentId\)/);
  assert.doesNotMatch(workload, /setOrologioGiocoVelocita\(|AsyncStorage|\bfetch\s*\(/);
});
