import assert from "node:assert/strict";
import test from "node:test";

import { PendingCommuteRetry } from "../src/game/pendingCommuteRetry.ts";

test("a pending commute collision retry resumes once after a pause", () => {
  const pending = new PendingCommuteRetry();
  let attempts = 0;
  pending.hold(() => { attempts += 1; });
  // Pausing clears the JS timer, not the pending continuation.
  assert.equal(attempts, 0);
  const continuation = pending.take();
  assert.ok(continuation);
  continuation();
  assert.equal(attempts, 1);
  assert.equal(pending.take(), null, "resume does not replay the same claim twice");
});

test("changing a commute path discards an old blocked retry", () => {
  const pending = new PendingCommuteRetry();
  let staleAttempts = 0;
  pending.hold(() => { staleAttempts += 1; });
  pending.clear();
  assert.equal(pending.take(), null);
  assert.equal(staleAttempts, 0);
});

test("a later collision retry replaces the previous continuation", () => {
  const pending = new PendingCommuteRetry();
  const attempts: string[] = [];
  pending.hold(() => attempts.push("old path"));
  pending.hold(() => attempts.push("new path"));
  pending.take()?.();
  assert.deepEqual(attempts, ["new path"]);
});

test("a retry already consumed by timer cannot fire again on resume", () => {
  const pending = new PendingCommuteRetry();
  let count = 0;
  pending.hold(() => count++);
  pending.take()?.();
  pending.take()?.();
  assert.equal(count, 1);
});
