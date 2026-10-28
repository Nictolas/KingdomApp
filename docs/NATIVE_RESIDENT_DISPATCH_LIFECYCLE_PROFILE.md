# Native resident dispatch: reentrant lifecycle safety and JS batch profiling

## Scope

This experiment extends Draft PR #297 (stacked on #296, which is stacked on
#295). It does not change the web Phaser benchmark #294, default/web resident
component, game rules, pathfinding, GameContext, saved games, databases or
production deployments.

The existing native map uses one RAF dispatcher for moving residents and one
cooperative timer queue for idle/collision waits. This change addresses two
specific questions:

1. Can a pause and immediate resume **inside the same JavaScript callback**
   cause another resident to advance using the previous frame/timer batch?
2. How long does the **real JS callback batch** take on a physical Android or
   iOS device, as distinct from RAF cadence, render FPS, or registration counts?

## Lifecycle correctness

A new `activityEpoch` increments on **every** active/inactive transition in
both `NativeResidentFrameBus` and `NativeResidentTimerQueue`.

- A frame or timer wakeup captures its current epoch. If a callback changes
  activity (even if it immediately restores the previous active state), the
  current batch stops. The remaining one-shot RAF callbacks and timer tasks
  remain pending; persistent subscribers are still registered.
- On the next native frame, all active moving residents receive the
  `resumedAfterSuspension` signal so movement clocks rebase. This prevents
  a frame interrupted by a reentrant pause/resume from mixing two epochs.
- The timer queue keeps the original *active-time* deadline, registration
  order and cooperative 32-callback limit. Already-due work continues on a
  fresh platform task rather than in the interrupted callback.
- A lifecycle listener may synchronously trigger a newer transition. Other
  listeners are not told about an **obsolete** transition after the new state
  was already published. A removed listener remains unsubscribed.
- Existing canceled-platform-callback generation guards remain unchanged.
  Reentrant transitions do not create more than one pending platform RAF or
  timeout at a time.

This is a **correctness fix**, not a claim that pausing or resuming is faster.
The normal case without reentrant transitions preserves the existing callback
order and budget. Pause and speed multipliers remain gameplay-controlled.

## Opt-in, bounded JS batch timing

`NativeResidentDispatchProfiler` is a pure in-memory module. It is started
only when the developer taps **Misura 10 secondi** in the native performance
HUD; otherwise the dispatchers do not read a profiling clock or allocate
samples. Each capture has a token, so a delayed callback from an old capture
cannot contaminate a new one. Background, route focus loss, unmount and
capture cancellation stop collection.

The profiler times **whole JS callback batches** using `performance.now()`:

- `frame`: work dispatched by the shared resident RAF (one-shots and
  persistent subscriptions, including callback execution and cleanup).
- `timer`: work dispatched by one platform timeout in the shared resident
  queue, including callback execution and rearming.

Each source has a fixed **4096-sample ring**. Only numeric durations are
stored. The 10-second report includes sample count, observed count, ring
overflow count, mean, p95, maximum, and batches exceeding 8/16 ms.
Percentiles are computed on retained samples; when overflow occurs the
report explicitly displays how many older samples were overwritten. There
is no network, disk, resident ID, coordinate, touch history, save data or
background profiler.

**Interpretation:** a batch exceeding 16 ms can contribute to JS-thread
contention, but is **not** proof that the device missed a GPU frame.
These timings do not measure UI-thread FPS, native draw calls, CPU
utilization, energy consumption or touch-to-display latency. A 10-second
session is observational and adds small profiling overhead. It cannot be
directly equated to the synthetic Node benchmark.

## Deterministic automated coverage

- Pure profiler tests: idle/no clock reads, cancellation, capture generation,
  bounded ring overwrite, mean/p95/max/thresholds, invalid clocks, and
  240 batches representing 200 resident updates each.
- Integration tests with 200 persistent RAF subscribers: a pause and resume
  inside the first callback stops the current frame; the next frame rebases
  and delivers every subscriber once.
- Integration tests with 200 one-shot RAF callbacks: the 199 unfinished
  callbacks are retained in order and delivered only on the next frame.
- Integration tests with 200 due collision retries: reentrant pause/resume
  stops after one callback and the remaining 199 callbacks drain in seven
  cooperative turns with no duplicates.
- Nested activity-listener test: a listener triggering a new state does not
  send an obsolete state to another listener.
- Combined app-gate test: RAF and timer queue pause/resume together while
  200 residents are active.
- Instrumentation integration: one frame batch and seven timer batches are
  counted, not 200 artificial per-resident profiler samples.
- Existing native suites still check segment runner, collisions, sprites,
  pause/background, speed 1×/2×/4× and 200-resident synthetic loads.
- CI exports JS bundles for Android, iOS and web. Exports are not
  installed-app tests.

## Manual on-device comparison (not yet performed)

Use the same representative map/save and the same phone in each run.
Build **baseline #295**, **native RAF #296** and **stacked #297** separately;
do not mix stacked branch commits. On each version:

1. Use the actual map, not only the synthetic marker scene. Repeat with
   25, 50, 100 and approximately 200 living residents; use comparable
   numbers of moving residents and visible cells.
2. Record at least three **10-second** measurements at 1×, 2× and 4×.
   Export the report using the in-app **Condividi risultati** button.
3. Compare JS RAF cadence (mean/p95, >33/>50 ms), RAF registrations,
   React render invocations, timer wakeups/yields, and (only in the new
   build) the RAF/timer JS batch p95/max. Do not treat missing profiler
   fields in older builds as zeros.
4. Separately check tap and double-tap selection, alignment of the
   moving sprite and its hit target, claims/collisions, commute arrival
   order, 1×/2×/4×, game pause, 30-second background, resume without
   teleportation, and rapid pause/resume.
5. Use Android Studio Profiler / Perfetto or Xcode Instruments for actual
   UI/GPU frame times, CPU and memory. The HUD cannot supply these.
6. Record device model, OS, build SHA, scene/population, temperature
   and any power-saving mode. Avoid interpreting noisy single-run results.

Do not merge until on-device behavior is checked. If a regression appears,
revert the profiler and epoch guards together or independently; both are
isolated to native performance modules.

## CI status

Results must be taken from the workflow attached to the *latest* PR #297
head commit. Synthetic correctness and JS bundle success do not imply
native FPS gains. The repository-wide TypeScript check may still report
legacy errors unrelated to these files; compare changed-file diagnostics
rather than claiming the entire repository passes.
