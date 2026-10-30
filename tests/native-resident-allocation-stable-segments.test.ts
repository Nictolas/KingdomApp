import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";

type Callback = (timestamp: number) => void;

function frames() {
  let nextId = 0;
  const os = new Map<number, Callback>();
  const canceled: Callback[] = [];
  const bus = new NativeResidentFrameBus(
    callback => {
      const id = ++nextId;
      os.set(id, callback);
      return id;
    },
    id => {
      const callback = os.get(id);
      if (callback) canceled.push(callback);
      os.delete(id);
    }
  );
  const gate = new NativeResidentActivityGate(true, false, active => bus.setActive(active));
  return {
    bus, gate, os, canceled,
    tick(at: number) {
      assert.equal(os.size, 1, "at most one native RAF regardless of population");
      const [id, callback] = os.entries().next().value!;
      os.delete(id);
      callback(at);
      assert.ok(os.size <= 1);
    },
    deliverCanceled(at: number) {
      for (const callback of canceled.splice(0)) callback(at);
    }
  };
}

function scenario(persistent: boolean, population = 200, legs = 20) {
  const f = frames();
  let at = 0;
  let speed = 1;
  const positions = Array<number>(population).fill(0);
  const completed = Array<number>(population).fill(0);
  const framesSeen = Array<number>(population).fill(0);
  const walking = Array<boolean>(population).fill(false);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      ...(persistent ? { subscribeFrame: (cb: (at: number, resumed: boolean) => void) => f.bus.subscribeFrame(cb) } : {}),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => {
        assert.equal(y, id);
        positions[id] = x;
      },
      advanceSprite: () => {},
      setWalking: next => { walking[id] = next; },
      onFrame: () => { framesSeen[id]!++; }
    })
  );
  const start = (id: number, leg: number): void => runners[id]!.start({
    from: { x: leg * 40, y: id }, to: { x: (leg + 1) * 40, y: id },
    durationMs: 128, startTimestamp: at,
    keepWalkingOnArrival: leg + 1 < legs,
    onArrival: () => {
      completed[id]!++;
      if (leg + 1 < legs) start(id, leg + 1);
    }
  });
  for (let id = 0; id < population; id++) start(id, 0);
  return {
    f, runners, positions, completed, framesSeen, walking,
    get at() { return at; },
    advance() { at += 16; f.tick(at); },
    setSpeed(value: number) { speed = value; },
    jump(ms: number) { at += ms; },
    allComplete() { return completed.every(value => value === legs); }
  };
}

test("200 residents × 20 consecutive tiles reuse exactly one per-runner native RAF closure", () => {
  const s = scenario(true);
  let frames = 0;
  while (!s.allComplete() && frames < 500) {
    frames++;
    s.setSpeed(frames < 80 ? 1 : frames < 135 ? 2 : 4);
    if (frames === 90) {
      const before = [...s.positions];
      s.f.gate.setGamePaused(true);
      s.f.gate.setForeground(false);
      assert.equal(s.f.os.size, 0);
      s.jump(90_000);
      s.f.gate.setGamePaused(false);
      assert.equal(s.f.os.size, 0);
      s.f.gate.setForeground(true);
      s.advance(); // rebase, no teleport
      assert.deepEqual(s.positions, before);
      s.f.deliverCanceled(s.at);
      assert.deepEqual(s.positions, before);
    }
    s.advance();
  }
  assert.ok(frames < 500);
  assert.ok(s.allComplete());
  assert.ok(s.positions.every(v => v === 20 * 40));
  assert.ok(s.walking.every(v => v === false));
  assert.equal(s.f.bus.snapshot().subscriptionAdds, 200);
  assert.equal(s.f.bus.snapshot().oneShotRequests, 0);
  assert.equal(s.f.bus.snapshot().queued, 0);
  assert.equal(s.f.os.size, 0);
  assert.equal(s.runners.reduce((sum, runner) => sum + runner.snapshot().segmentStarts, 0), 4_000);
  assert.equal(s.runners.reduce((sum, runner) => sum + runner.snapshot().frameCallbackAllocations, 0), 0);
});

test("one-shot reference still creates token-bound closures and produces identical 200-sprite pixels on every frame", () => {
  const fast = scenario(true, 200, 8);
  const reference = scenario(false, 200, 8);
  for (let frame = 1; frame < 220; frame++) {
    const speed = frame < 30 ? 1 : frame < 75 ? 2 : 4;
    fast.setSpeed(speed);
    reference.setSpeed(speed);
    assert.equal(fast.f.os.size, reference.f.os.size);
    if (!fast.f.os.size) break;
    if (frame === 55) {
      const fastBefore = [...fast.positions];
      fast.f.gate.setGamePaused(true);
      reference.f.gate.setGamePaused(true);
      fast.f.gate.setForeground(false);
      reference.f.gate.setForeground(false);
      fast.jump(120_000);
      reference.jump(120_000);
      fast.f.gate.setGamePaused(false);
      reference.f.gate.setGamePaused(false);
      fast.f.gate.setForeground(true);
      reference.f.gate.setForeground(true);
      fast.advance();
      reference.advance();
      assert.deepEqual(fast.positions, fastBefore);
      assert.deepEqual(fast.positions, reference.positions);
    }
    fast.advance();
    reference.advance();
    assert.deepEqual(fast.positions, reference.positions, "position mismatch at frame " + frame);
    assert.deepEqual(fast.completed, reference.completed, "arrival mismatch at frame " + frame);
    assert.deepEqual(fast.walking, reference.walking, "walking mismatch at frame " + frame);
  }
  assert.ok(fast.allComplete());
  assert.ok(reference.allComplete());
  assert.equal(fast.runners.reduce((sum, runner) => sum + runner.snapshot().frameCallbackAllocations, 0), 0);
  assert.equal(reference.runners.reduce((sum, runner) => sum + runner.snapshot().frameCallbackAllocations, 0), 1_600);
  assert.equal(fast.f.bus.snapshot().subscriptionAdds, 200);
  assert.equal(reference.f.bus.snapshot().oneShotRequests > 1600, true);
});

test("200 route replacements during callbacks discard old arrivals and positions", () => {
  const f = frames();
  const arrivals = Array<number>(200).fill(0);
  const positions = Array<number>(200).fill(-1);
  const runners: NativeResidentSegmentRunner[] = [];
  for (let id = 0; id < 200; id++) {
    const runner = new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 1,
      writePositionXY: x => {
        positions[id] = x;
        if (x === 50) {
          runners[id]!.start({
            from: { x: 500, y: 0 }, to: { x: 600, y: 0 },
            durationMs: 100, startTimestamp: 50,
            onArrival: () => { arrivals[id]!++; }
          });
        }
      },
      advanceSprite: () => {},
      setWalking: () => {}
    });
    runners.push(runner);
    runner.start({
      from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
      durationMs: 100, startTimestamp: 0,
      onArrival: () => { throw Error("obsolete arrival"); }
    });
  }
  f.tick(50);
  assert.deepEqual([...positions], Array<number>(200).fill(50));
  assert.equal(f.bus.snapshot().continuousSubscribers, 200);
  f.tick(150);
  assert.deepEqual([...positions], Array<number>(200).fill(600));
  assert.ok(arrivals.every(n => n === 1));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.ok(runners.every(r => r.snapshot().segmentStarts === 2 && r.snapshot().frameCallbackAllocations === 0));
  f.deliverCanceled(999);
  assert.ok(arrivals.every(n => n === 1));
});

test("persistent 200-route failure isolation: broken callback unsubscribes; 199 unaffected", () => {
  const f = frames();
  const complete = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: () => {},
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  for (let id = 0; id < 200; id++) runners[id]!.start({
    from: { x: 0, y: id }, to: { x: 100, y: id },
    durationMs: 100, startTimestamp: 0,
    onArrival: () => {
      if (id === 0) throw new Error("fault");
      complete[id]!++;
    }
  });
  assert.throws(() => f.tick(25), /fault/);
  assert.equal(complete.reduce((a, b) => a + b, 0), 199);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.ok(runners.every(r => r.snapshot().scheduled === false));
  f.deliverCanceled(1000);
  assert.equal(complete.reduce((a, b) => a + b, 0), 199);
});

test("50 unmounts and respawns while paused preserve lifecycle and no ghost RAF", () => {
  const s = scenario(true, 200, 4);
  s.advance();
  s.f.gate.setForeground(false);
  const removed = Array.from({ length: 50 }, (_, i) => i * 4);
  for (const id of removed) s.runners[id]!.stop();
  assert.equal(s.f.bus.snapshot().continuousSubscribers, 150);
  s.jump(200_000);
  s.f.deliverCanceled(s.at);
  assert.equal(s.f.os.size, 0);
  s.f.gate.setForeground(true);
  const old = s.runners.map(r => r.snapshot().completed);
  s.advance();
  assert.deepEqual(s.runners.map(r => r.snapshot().completed), old);
  for (const id of removed) assert.equal(s.runners[id]!.snapshot().active, false);
  assert.equal(s.f.bus.snapshot().continuousSubscribers, 150);
  for (const id of removed) s.runners[id]!.start({
    from: { x: 0, y: id }, to: { x: 10, y: id },
    startTimestamp: s.at, durationMs: 100,
    onArrival: () => {}
  });
  assert.equal(s.f.bus.snapshot().continuousSubscribers, 200);
  assert.ok(s.runners.every(r => r.snapshot().frameCallbackAllocations === 0));
  s.runners.forEach(runner => runner.stop());
  assert.equal(s.f.bus.snapshot().queued, 0);
  assert.equal(s.f.os.size, 0);
});

test("native-only refactor removes per-segment validation array and persistent RAF step closure", () => {
  const source = readFileSync(new URL("../src/performance/nativeResidentSegmentRunner.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\[request\.from\.x,\s*request\.from\.y/);
  assert.match(source, /this\.currentPersistentRequest = request/);
  assert.match(source, /private runFrame\(/);
  assert.match(source, /this\.frameCallbackAllocations\+\+/);
  const body = source.slice(source.indexOf("if (this.deps.subscribeFrame) {", source.indexOf("start(request:")),
    source.indexOf("  /** One segment executor"));
  assert.doesNotMatch(body, /const step: FrameCallback = \(now/);
});
