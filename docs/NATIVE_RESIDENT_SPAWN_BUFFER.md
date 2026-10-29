# Native resident cold-spawn buffer — PR #297 only

## Problem and change
The real Android/iOS resident renderer previously built a fresh array of
every eligible map cell for each uninitialized resident mount. With 200
residents this means 200 full-map candidate arrays at cold scene entry.
This is distinct from the ongoing movement hot path already optimized by
NativeResidentNeighborSampler.

NativeResidentSpawnSampler now shares one Int32Array across sequential native
resident mount effects. It grows only when the map grows. Reentrant predicate
or claim callbacks receive an independent buffer. No walkability/occupancy
snapshot persists between calls. Retained storage is ~4 bytes per cell of the
largest map seen (50,000 cells ~200 KB), not zero memory.

Exact old behavior is retained: preferred free cell; walkable preferred cell
even when exclusive claim fails (shared home); ascending free+walkable list;
fallback to all walkable if none free; (instanceId * 9973) % count start;
sequential atomic claim attempts. No change to gameplay rules, GameContext,
saves, the web renderer or the four shared #297/#298 A/B fixture files.

## Validation
Run:
- npx tsx --test tests/native-resident-spawn-sampler.test.ts
- npx tsx tests/native-resident-spawn-sampler-benchmark.ts

Tests compare with the literal pre-change algorithm and call order for
preferred/occupied cases, 25/50/100/200 residents, maps with 25–10,000
cells, dynamic occupancy, 200 unique claims, 20×200 remounts, exceptions,
reentrancy, fallback and native/web isolation.

The Node benchmark measures 200 cold spawns on 400/10,000/50,000 cells for
seven rounds, checks output parity, prints median JS times and counts array
allocations. The previous algorithm allocates 200 candidate arrays per mount;
after one shared typed-buffer allocation the new one allocates zero ordinary
per-resident candidate arrays. This does not prove mobile CPU, GC or FPS gains.

## Risk and device acceptance
A larger map increases the one retained buffer; preferred shared-home
fallback remains intentionally unchanged. Use the same Android and iPhone
hardware and compare cold and warm scene entry, JS stalls/GC, touch,
1×/2×/4×, pause/background, pan/zoom and collisions on #298 versus #297.
Neither Node tests nor Expo JS bundles are physical-device validation.
No merge, deployment or release without explicit approval.
