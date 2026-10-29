# MyKingdom: Android View-frame A/B evidence (#298 vs #297)

## Scope and safety

This is a **device-data preparation and offline verification** tool, not a claimed physical benchmark. The assistant has **not** measured an Android device. The #298 experimental real-sprite baseline and #297 candidate keep their four shared fixture files identical. #295 is suitable for marker-only diagnostics and must **not** be substituted as the real-sprite baseline.

The script scripts/analyze-native-android-framestats.mjs parses Android's adb shell dumpsys gfxinfo PACKAGE framestats CSV records. It calculates **View frame completion latency** from FrameCompleted minus IntendedVsync using BigInt nanosecond subtraction, then reports median, p95, p99, worst frame, counts above one/two chosen refresh budgets and the covered frame-timestamp span. These are not GPU FPS, application FPS, physical touch latency, CPU cost, battery use or an Android/iOS performance certification.

Android developer reference: https://developer.android.com/tools/dumpsys
AOSP frame format: https://android.googlesource.com/platform/cts/+/1dd5219231180f3f3d4a28ffd260d0e80d2e390d/hostsidetests/dumpsys/src/android/dumpsys/cts/GfxInfoDumpsysTest.java

## Preconditions

- Install **two distinct development builds** from #298 and #297 on the **same physical Android device**, without releasing or merging either branch. The current Expo JavaScript exports in CI are **not installable APKs**. Generating/signing installable builds requires the normal local build environment and its credentials.
- Determine the **actual package identifier** from the app's checked native Android configuration; do not assume that PACKAGE below is the literal package name. Use the same tested screen, camera placement, scene, movement mode, population and speed on both builds.
- Set the device's refresh rate to a known stable value (60/90/120/144 Hz), disable dynamic refresh switching if possible, keep power/temperature/network conditions comparable and record them outside the analyzer. The tool needs refreshHz explicitly and never guesses it.
- Prefer the *repeatable commute* real-sprite scene for like-for-like motion; use random roaming separately for collisions. Let all 200 sprite occupancies settle and complete the first walk as required by the lab readiness checks. Capture 1×, 2× and 4× separately. Do not change scene/zoom/population/speed during a measurement.

## Collection (on a Windows PC with Android platform-tools)

In PowerShell, replace PACKAGE with the verified Android package identifier. Run one baseline or candidate build at a time:

    adb devices
    adb shell dumpsys gfxinfo PACKAGE reset

Navigate to /native-perf, choose (for example) 200 residents, repeatable commute, 4× and let the scene stabilize. Start the test window, then run after the chosen interval:

    adb shell dumpsys gfxinfo PACKAGE framestats > before-0.txt

Repeat for before-1.txt and before-2.txt; collect after-0.txt through after-2.txt using the #297 build, resetting the stats between captures. Alternate build order in repeated trials when possible. Do **not** share raw dumps publicly: they may include package names and other diagnostic details. The analyzer outputs aggregates only.

**Critical limitation:** gfxinfo framestats typically retains a *rolling subset* of recent View frames (historically around 120), not necessarily all frames produced during the ten-second JS diagnostic capture. The analyzer reports observedSpanMs and a short-buffer warning instead of calling this a 10-second hardware measurement. For a complete device trace and UI/GPU scheduling, use Android Macrobenchmark/Perfetto/FrameTimeline on the device. Do not compute physical FPS by dividing frames in the rolling dump by ten seconds. iOS requires Xcode Instruments/Core Animation profiling separately.

If the dump contains multiple PROFILEDATA blocks (multiple View roots), the comparison tool **rejects** it instead of mixing windows. Resolve/select the correct app window and recapture or use a dedicated instrumentation pipeline; do not silently merge unrelated views.

## Manifest and comparison

Put the six text dumps alongside a local file named manifest.json:

    {
      "schemaVersion": 1,
      "platform": "android",
      "scene": "Sprite abitanti reali in tragitto ripetibile",
      "residents": 200,
      "speed": 4,
      "refreshHz": 60,
      "samePhysicalDeviceConfirmed": true,
      "pairs": [
        {"baseline": "before-0.txt", "candidate": "after-0.txt"},
        {"baseline": "before-1.txt", "candidate": "after-1.txt"},
        {"baseline": "before-2.txt", "candidate": "after-2.txt"}
      ]
    }

The samePhysicalDeviceConfirmed field is a **human declaration**, not a technical verification of hardware identity. Scene, speed, build provenance and refresh rate also require external operator checks; raw gfxinfo does not encode them. Incorrect attestations make results unreliable.

Run locally with Node.js installed:

    node scripts/analyze-native-android-framestats.mjs --manifest manifest.json --json

The analyzer requires three or more distinct paired captures. It validates the manifest, block layout, flags and timestamps; uses a declared refresh budget rather than assuming 60 Hz; refuses directory traversal and symlink escapes; never accesses the network, modifies files, or approves a release. Rows with nonzero Flags or invalid/implausible timing are excluded and counted; a report with fewer than 30 valid rows is rejected. The CLI emits no filenames, device identifiers or raw timestamps.

A negative paired p95 delta is **an observed difference in the supplied Android View-latency samples**, not a proven device-wide performance speedup. Report the number and span of frames, hardware conditions and trial variability; manually review any regression before suggesting integration.

## CI and operational limits

The dedicated #297 workflow runs tests/native-android-framestats.test.mjs together with the existing JS A/B analyzer tests. These synthetic tests validate parsing, modern timestamp precision, 60/90/120/144 Hz thresholds, malformed/flagged rows, rolling-buffer warnings, 3-pair comparison, scenario attestations, path isolation and CLI output. They do **not** run adb, create APK/IPA artifacts, benchmark a phone, validate actual touch hit targets or alter the #298 baseline.

Release gate remains: independent native CI, Expo Android/iOS/web JS export checks, physical Android/iPhone tests for 25/50/100/200 sprites, pause/background, collisions, touch selection, 1×/2×/4× and scene continuity, plus manual interpretation of actual device measurements. No merge, deploy or release without separate authorization.


## Full Android evidence matrix (25/50/100/200 × 1×/2×/4×)

The single-scenario command above is useful for one controlled diagnostic. The separate full-matrix tool now verifies **12 distinct real-native-sprite scenarios, with at least three #298/#297 paired runs each**: 72 raw gfxinfo files in total. It does not pool unlike populations or speed settings into one misleading global performance "improvement".

Generate a complete manifest template locally (Node.js; output redirected to UTF-8):

    node scripts/generate-native-android-ui-matrix-template.mjs > matrix.json

Use --pairs 4 through --pairs 10 to request additional independent capture pairs. By design the generated JSON sets:
- refreshHz to null: enter the real display refresh, checking that a dynamic-refresh device did not change it.
- samePhysicalDeviceConfirmed to false: change only after personally verifying both builds were measured on the same physical hardware.
- scene to the actual repeatable-commute real-sprite scene; do not substitute #295's marker benchmark.
- all 12 population/speed combinations, with distinct names such as baseline-200-4x-1.txt and candidate-200-4x-1.txt.

Capture each trial from **two genuinely installed native builds**, reset gfxinfo before each sample, allow both scenes to reach readiness and retain exactly the chosen camera and renderer conditions. Distinguish baseline (#298) from candidate (#297), and document build commits separately: names and human attestations do not cryptographically prove which binary produced a dump.

When 72 or more local files are available:

    node scripts/compare-native-android-ui-matrix.mjs --manifest matrix.json --json

This command **rejects incomplete coverage** and reused file names across scenarios, while --allow-partial explicitly allows an incomplete preliminary review. It checks 3–10 paired captures per scenario, input consistency, frame timestamp quality, directory escapes and symlink aliases. The output includes per-scenario median paired p95 differences, over-budget frame-percentage-point differences, frame counts and quality warnings. It does not automatically approve a change; no numbers are fabricated for untested devices.

**Continuity safeguard:** as well as detecting short rolling buffers, the analyzer now reports the largest interval between consecutive IntendedVsync timestamps and duplicated vsync timestamps. A ten-second min/max span does not establish ten seconds of continuous sampling if several seconds of frame data are absent. This triggers warnings for manual review; for accurate frame rendering and GPU attribution, use FrameTimeline/Perfetto/Macrobenchmark. For iPhone, obtain independent Xcode Instruments measurements: Android gfxinfo cannot measure iOS.

The dedicated native CI includes parser tests, the 12-scenario/72-dump synthetic matrix audit and template generator tests. Every fixture uses fake Android timestamps. They prove parser behavior, **not physical device smoothness**. Android and iOS Expo JavaScript exports likewise are not installable or measured builds.
