# Native-only recovery for failed arrival before logical settlement (29 October 2026)

## Defect and scope

A resident reserves its destination before motion begins. PR #297 already
recovers the reservation when `face()` or `motion.start()` throws.
However, an arrival callback can itself throw **before** `publishCell` updates
the settled cell (for instance, during release of a shared-home street claim).
The native runner correctly terminates its RAF after the callback error, but
without occupancy recovery, the destination can remain reserved with the old
logical origin still recorded. This is a deterministic code-path risk under
injected errors, not a confirmed real-phone failure.

## New guard

- Both native idle/free-roam and scripted commute arrival callbacks now use a
  failure-only `try/catch`; the parent error remains observable and unchanged.
- If the logical cell is STILL the old origin and this route owns the claim,
  restore that origin if free; otherwise release the obsolete destination
  without evicting another resident.
- If `publishCell` has already settled the destination, never reverse the
  genuine settlement because a later parent callback fails.
- Commute additionally checks its route epoch; an obsolete callback can
  neither reclaim nor release a newer route's reservation.
- Shared-home entries whose optional destination claim was denied are never
  treated as an owned destination.
- Nothing changes on successful arrivals; this is outside the per-frame RAF
  hot path. No changes to GameContext, saves, web renderer, gameplay clock,
  delivery semantics, nightly speed or the #298 A/B baseline.

## Tests and limits

`tests/native-resident-arrival-fault.test.ts` exercises unsettled faults,
post-settlement parent failures, falsy exceptions, route replacement, occupied
origins, and 200 native runners × 20 segments = 4,000 arrivals. There are 800
injected pre-settlement faults at 1×/2×/4× with pause/background rebasing and
occupancy invariants, plus wiring checks that the web renderer is unchanged.
It runs in the native commute/night suite and its source trigger is pinned in
the workflow isolation tests.

The tests use fake OS callbacks in Node. They cannot prove UI/GPU FPS, touch
latency, memory or bridge behavior on actual Android and iPhone devices. Real
device A/B comparison #298 vs #297 is still a pre-merge requirement.
