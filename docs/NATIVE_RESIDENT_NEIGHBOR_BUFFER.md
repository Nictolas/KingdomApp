# MyKingdom — native free-roam neighbor allocation reduction

## Scope and invariant

Only the **native** \`MapWandererCharacter.native.tsx\` free-roam picker changes.
The previous path created a neighbor array and a filtered array for every
idle wakeup and every retry; with 200 residents, this causes repeated small
JS allocations and GC pressure. Each native resident now owns a single
four-cell \`Int32Array\` used across all idle selections. Reentrant callbacks
use a rare fallback scratch buffer to avoid corrupting an outer selection.

Selection semantics are preserved: neighbor order **left/right/up/down**,
walkability and occupancy filters, Fisher-Yates random draw count/order,
then sequential \`tryClaimCell\` attempts. No change to movement speed,
pathfinding, pause, 1×/2×/4× game time, collision rules, game state,
save format, web renderer or production release.

## Validation

\`npx tsx --test tests/native-resident-neighbor-sampler.test.ts\` covers
all 400 fixture cells × three seeded streams, 200 residents × 1,200
selection attempts × 1×/2×/4×, denied claims, corners, zero candidates,
reentrant occupancy callbacks, exception recovery and native/web isolation.
These are deterministic **Node** regressions, not measurements of a device.

\`npx tsx tests/native-resident-neighbor-sampler-benchmark.ts\` compares
500,000 synthetic selections per variant after warmup. It checks equal
checksums and reports elapsed Node time without pass/fail speed thresholds.
Actual garbage collection behavior and any FPS/latency effect must be
profiled on Android and iPhone physical hardware.

## Device acceptance

Use identical #298 baseline and #297 candidate real-sprite fixture,
25/50/100/200 residents at 1×/2×/4×; capture three independent 10-second
runs per scenario, plus native profiler traces (JS thread, GC, UI/GPU,
touch) and visually inspect occupancy, idle movement and pause/background.
The synthetic selection microbenchmark is **not** evidence of an
on-device FPS improvement. Do not merge until real-device validation.
