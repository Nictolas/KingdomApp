# BK-017 real renderer performance test

Open the web map with `?perf=1` appended to the URL.

The Phaser overlay reports a rolling window of up to 600 frames:

- mean FPS
- average frame time in ms
- p95 frame time in ms
- frames above 33 ms
- frames above 50 ms
- sample count

Recommended manual scenarios, at least 15 seconds each:

1. idle map at zoom 1
2. continuous pan across the map
3. repeated zoom 0.5x -> 3x -> 1x
4. pan while characters are moving
5. dense building/character area if available

Record the stable overlay values near the end of each scenario. Compare p95 and slow-frame counts first; mean FPS alone can hide spikes.
