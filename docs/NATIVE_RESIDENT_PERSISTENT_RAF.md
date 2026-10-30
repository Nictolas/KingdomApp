# MyKingdom native: persistent resident RAF subscriptions (PR #297)

## Objective and scope

The native movement engine previously re-registered a one-shot callback
for **every moving resident on every animation frame**. The existing
`NativeResidentFrameBus` already ensured **one platform RAF** regardless
of resident population, but with 200 moving residents over 240 frames,
the JavaScript code still performed **48,000 logical registrations**,
and each frame constructed/repopulated a Map of one-shot callbacks.

This change introduces a **persistent subscription** for each active
native segment, while retaining the one-shot API for existing callers.
It reduces registration work to **one registration per resident per
segment**. A 200-resident, 240-frame synthetic workload with a single
uninterrupted segment each therefore needs **200** registrations instead
of 48,000: **47,800 fewer** (99.58% reduction in *registrations*, not CPU
time or FPS). A real route with many tile segments may now reuse **one registration**
through consecutive segments started synchronously by `onArrival`.
The subscriber is still removed when the route ends, pauses via the
shared bus, is interrupted, or no next segment is started.

The native-only `MapWandererCharacter.native.tsx` opts into the new
API through `NativeResidentSegmentRunner`. The default/web
`MapWandererCharacter.tsx`, Phaser benchmark #294, GameContext,
gameplay path selection, cell ownership, collision rules, game clock,
save format, production services and release branches are unchanged.

## Implementation

1. `NativeResidentFrameBus.subscribeFrame(callback)` registers a stable
   callback. `cancel(id)` disposes either a persistent subscription or
   a legacy one-shot callback. The bus schedules **one OS RAF** whenever
   either type of work exists, and none when both are empty or paused.
2. Persistent callbacks stay in a single `Map` between frames.
   An **ID cutoff captured at frame start** prevents newly registered
   subscribers from running in the same frame without copying all 200
   callbacks into a new array or Map. Cancellation during dispatch
   removes the callback immediately from the iterator. A pause stops
   the current batch and the first resumed frame carries the same
   clock-rebase signal used by one-shot movement.
3. The segment runner accepts an optional `subscribeFrame` dependency.
   Existing one-shot tests/callers remain supported. The native runner
   retains its registered dispatcher during a synchronous
   `onArrival → start` chain, so consecutive tiles are first sampled
   on the following RAF without remove/re-add of their subscription.
   If no next segment starts, cleanup in `finally` unsubscribes,
   including on thrown callbacks. External replacements still cancel
   and subscribe afresh; generation guards reject stale work.
4. The dev-only HUD shows active persistent subscribers and the rate
   of persistent/one-shot registrations. A user-triggered 10-second
   report includes the same aggregate counts. No IDs, positions,
   touch history, game data, storage or network are added.

## Deterministic verification

- Frame-bus tests: 200 persistent residents for 240 frames; pause,
  foreground/background, canceled OS callback delivery, cancellation
  and new subscriptions during dispatch, callback errors, 40 unmounts,
  40 respawns and 20 pause cycles.
- Segment-runner tests: 200 moving residents across 1×/2×/4×,
  50 removals, 5,000 consecutive route replacements, synchronous
  replacement during an Animated.Value write, and 200 residents
  completing four sequential segments each (800 arrivals).
- Native sprite/timer integration: 200 real runner objects, sprite
  frame offsets, a shared RAF, collision retries, pause/background,
  50 timer cancellations and 32-callback cooperative timer batches.
- Native/web boundary: native component opts into persistent
  subscriptions; default/web component remains unchanged.
- A synthetic Node benchmark compares one-shot and persistent
  registrations at 200 residents/240 frames and 1,000 residents/120
  frames. It records counts and local CPU timings, but intentionally
  sets **no absolute timing threshold** because GitHub runners vary.

These are algorithmic and synthetic JS checks. Expo Android/iOS/web
bundle exports are *smoke tests*, not installed-app tests or GPU/UI FPS.

## Expected structural counts

| Synthetic workload | One-shot registrations | Persistent registrations | Avoided |
| --- | ---: | ---: | ---: |
| 200 residents × 240 frames, one segment | 48,000 | 200 | 47,800 |
| 1,000 residents × 120 frames, one segment | 120,000 | 1,000 | 119,000 |
| 200 residents × four synchronous segments | Depends on segment frame counts | 200 | 600 fewer persistent registrations than the former per-segment strategy |

These are deterministic registration counts, **not measured FPS or
battery savings**. Total callback dispatches remain identical;
persistent subscriptions reduce registration churn, not the work of
updating all visible moving sprites.

## Manual device acceptance

Use an Android device and an iPhone with the same representative
save/test scene. For **real native sprite** comparisons, use the
identical fixture in **#298 (baseline)** and **#297 (candidate)**,
25/50/100/200 residents at 1×, 2× and 4× with three captures
per branch/scenario. #295 remains a markers-only diagnostic baseline. Compare
JS frame p95, frames >33/50 ms, frame-bus subscriptions and render
counts. Separately inspect native UI responsiveness (tap and double
tap selection), correct sprite direction and hit target alignment,
collision avoidance, arrival order, pauses, background/foreground
resume, no teleport, and battery/heat if practical. Device GPU/UI FPS
requires a platform profiler; the in-app HUD measures JS RAF pacing
only. A result cannot be claimed until actual measurements exist.

## Isolation and rollback

PR #297 remains Draft stacked on #296 (native RAF/motion) stacked on
#295 (baseline/diagnostics). PR #294 is the separate Phaser/web
benchmark. Revert the changes to `subscribeFrame` and its native
injection to return to one-shot scheduling; the legacy bus API remains
available. No merge, deploy or destructive migration is part of this work.


## 29 ottobre — eliminazione del churn RAF fra celle a 4×

Nella revisione successiva il runner distingue i **tragitti concatenati
sincronicamente** dalle sostituzioni asincrone/esterne. La sottoscrizione
persistent rimane registrata durante l'`onArrival` e viene riutilizzata
soltanto se l'`onArrival` avvia immediatamente il segmento seguente
dello **stesso runner**. Il dispatcher è stabile e punta alla callback
del segmento corrente; un token di generazione invalida quella vecchia.
La callback rimane differita al prossimo frame perché lo stesso
subscriber ha già partecipato al frame di arrivo.

Se il tragitto termina, viene cancellato, c'è una collisione o il
callback lancia un errore, il runner libera la sottoscrizione. Una
sostituzione esterna non conserva l'ID precedente: mantiene quindi
l'ordinamento del frame bus e il confine fra i percorsi. Non cambiano
interpolazione, durata strada/non-strada, scelta delle celle, sprite,
claim/occupancy, pause o velocità di gioco.

`tests/native-resident-4x-subscription-reuse.test.ts` modella 200
runner effettivi, 12 segmenti consecutivi a 4× per residente
(**2.400 start**), un'unica registrazione per residente, una pausa
app di 80 secondi, callback OS obsolete, cleanup finale, cambio
graduale 1×/2×/4× e un callback di arrivo che genera un'eccezione.
I risultati sono **contatori sintetici**: nessuna affermazione su FPS,
CPU, latenza del touch o consumo batteria prima di test fisici.
