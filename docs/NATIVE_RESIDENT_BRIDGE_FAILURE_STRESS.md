# Native resident scheduler fault recovery — 200 sprites / 1,600 waits

## Scope and motivation

This is a **Node fault-injection regression**, not an Android/iPhone FPS or
battery benchmark. It exercises the two native-only scheduling mechanisms
together under an unusually dense, deterministic workload:

- 200 persistent resident animation subscribers sharing one platform RAF.
- 1,600 logical idle/collision deadlines (eight per simulated resident)
  sharing one platform timeout.
- A single foreground-to-background transition where **both** host
  cancellation functions throw before removing their scheduled callback.
- Delivery of the old, uncanceled callbacks while paused **and after**
  returning to the foreground. Generation tokens must reject them.
- An 80,000 ms wall-clock suspension that must not advance the active-time
  deadlines or teleport sprites on the first resumed animation frame.
- A burst of 1,600 due callbacks that must complete in 50 cooperative
  batches of at most 32, without duplicate execution or abandoned work.
- Unmount of all 200 subscribers, leaving no owned platform RAF.

The test also verifies a failing last-subscriber RAF cancellation, a
one-time RAF registration exception, a one-time timer registration exception,
and preservation of the first error (including falsy thrown values) when
both lifecycle adapters fail.

## What is and is not being validated

The fixture uses injected fake requestAnimationFrame/setTimeout adapters and
a deterministic monotonic wall clock. Its assertions concern scheduler
ownership, logical callback counts, suspension, stale callback isolation,
recovery, and cooperative callback limits. It does **not** instantiate a
physical React Native view, exercise real touch targets or collision geometry,
measure UI/GPU FPS, or prove that 200 visible sprites run smoothly on a phone.

The production implementation is in
`src/performance/nativeResidentFrameBus.ts`,
`src/performance/nativeResidentTimerQueue.ts`, and
`src/performance/nativeResidentSchedulerActivity.ts`.
The new regression lives in
`tests/native-resident-scheduler-bridge-recovery.test.ts`, alongside the
existing bridge-fault and native resident integration suites.

Run locally from the repository root:

```sh
npx tsx --test tests/native-resident-scheduler-bridge-recovery.test.ts
```

The native diagnostics workflow runs this test as part of its independent
pure JS/TS suite. GitHub Actions bundle exports for Android, iOS and web are
JavaScript packaging smoke tests only, **not installable device builds**.
The unrelated general TypeScript CI baseline may remain red; compare its
error count against the recorded baseline instead of claiming it is green.

## Acceptance and rollback

Keep PR #297 Draft and stacked on #296. The four A/B fixture files must
remain Git-blob-identical to the laboratory baseline PR #298. PR #295 is
markers-only and must not be substituted for #298 in the real-sprite A/B
comparison. No web renderer, GameContext, save format, game rules, main
branch or production release is modified by this regression.

For release acceptance, still capture **three runs per 25/50/100/200
resident scenario at 1×/2×/4×** on both Android and iPhone, compare #297
against #298 on the same devices, and separately validate touch,
collision/occupancy, pause/background and native UI/GPU frame pacing.
Synthetic correctness tests cannot substitute for these measurements.

The test file and its workflow registration can be reverted independently
without changing game state or persistent data.
