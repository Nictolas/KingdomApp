# Native resident route transitions — commute, night and idle (28 October 2026)

## Confirmed source-level regression and scope

In `MapWandererCharacter.native.tsx`, React runs the commute effect before the fixed-home and morning-wake effects. When `fixedCell` changed together with `commutePath`, the latter effects could call `motion.cancel()` after a valid commute had already started. A remembered night cell could also snap the sprite back home after the commute path was removed. Finally, removing a completed commute canceled its scheduled idle timeout, potentially leaving the resident stopped indefinitely until another activity transition.

The native-only route arbitration now explicitly prioritizes a valid commute path (length >= 2) over the fixed-home anchor, consumes a night exit once, invalidates stale remembered exits when commuting, and re-arms idle when a completed commute is cleared or roaming is re-enabled. The rearm is guarded by active app/game state, valid logical position, no ongoing movement and no existing timer. Pauses and background never initiate movement. The existing `NativeResidentTimerQueue` remains the sole timer scheduler.

## Verification and limits

`tests/native-resident-route-transitions.test.ts` covers simultaneous home/commute updates, route clearing, repeated wake-up, disabled roaming, and a deterministic 200-resident × 200-cycle (40,000 transitions) stress model. A source boundary test confirms the native renderer uses the arbiter and the web renderer does not. The native diagnostic workflow runs the tests and JavaScript bundles separately.

These are **pure transition and source-level tests**, not a mounted React integration test, a physical touch test, or Android/iPhone FPS. Mid-segment cancellation by an external route replacement remains a distinct occupancy/position consistency scenario requiring targeted follow-up and device checks; the idle rearm deliberately does not fire while the sprite reports movement. No GameContext, save data, world clock, gameplay design, web renderer, main branch, merge or release is changed.

The A/B fixture files in #297 and #298 remain byte-identical; this correction is **only on the candidate #297**, so a route-transition correctness comparison must account for it separately from pure movement FPS.

## Follow-up: interrupted movement must clear the walking flag

The previous native commute cleanup used `motion.cancel()`. That correctly
invalidated the old RAF and arrival callback but intentionally did **not**
call `setWalking(false)`, because `cancel()` is also used between chained
segments. If a route was removed during an unfinished segment, the
`isMovingRef` flag could remain true, causing the new idle-rearm guard to
skip the resident indefinitely, even though no RAF remained subscribed.

`NativeResidentSegmentRunner.stop()` now explicitly separates an **ended
route** from a seamless **segment replacement**: it cancels first (generation
invalidates stale RAF callbacks), then clears the walking state. The native
commute effect cleanup calls `stop()`; chained movement still uses
`cancel()` so there is no forced sprite-stop between consecutive steps.
The night/home effects already reset the moving state separately.

The regression suite checks a deterministic 200-runner workload with 100
interruptions, including 50 while backgrounded/paused, 50 route replacements,
1×/4× progress, late OS RAF delivery, and absence of obsolete arrivals.
A separate test covers synchronous listener-triggered replacement during
`stop()`. The source-boundary test now matches the actual fixed-cell guard
and requires the native commute cleanup to use `stop()`. The web renderer
is untouched. These are **Node fake-RAF tests**, not device FPS or touch
measurements; physical A/B checks and the unresolved mid-segment
position/occupancy reconciliation still remain necessary.

## 28 ottobre — arresto terminale unificato e stress di 200 residenti

Il reset di un tragitto, il rientro in casa e il risveglio ora usano
`NativeResidentSegmentRunner.stop()`, che invalida la sottoscrizione RAF
**e** disattiva lo stato di camminata. Le assegnazioni manuali duplicate a
`isMovingRef` e `spriteFrames.setMoving(false)` sono state rimosse da questi
tre percorsi; il reset resta confinato al renderer `.native.tsx`.
La cancellazione in unmount continua a usare `cancel()` e il cleanup del
commute conserva `stop()`.

La suite verifica il confine native/web e un nuovo stress test con 200
istanze vere di `NativeResidentSegmentRunner`, 180 frame simulati, oltre
1.200 avvii di segmenti, 40 stop/ripartenze per ciclo, velocita'
1x/2x/4x, dodici pause/background e callback RAF obsolete consegnate
artificialmente. Invarianti: un solo RAF di piattaforma, nessuna
animazione dopo stop, nessun arrivo fantasma, nessuna sottoscrizione
residua dopo teardown. I test sono Node con clock/RAF simulati: non
misurano FPS o latenza su Android/iOS fisici.

Il test di confine non conta piu' cinque chiamate letterali a
`motion.cancel()`, aspettativa divenuta obsoleta dopo l'introduzione
di `motion.stop()`; verifica invece entrambi i metodi e i percorsi
terminali. Non sono stati modificati il web Phaser, GameContext,
salvataggi o la fixture A/B condivisa con la #298. CI e bundle da
verificare sul commit effettivo prima di qualsiasi merge.

## 28 ottobre — riparazione occupancy durante interruzioni a metà cella

Problema confermato nel codice nativo: il renderer prenota `to` prima di
avviare il segmento, ma aggiorna `cellRef` soltanto all'arrivo. Se il
percorso cambia a metà animazione, annullare il RAF da solo può lasciare
prenotata la vecchia destinazione, mentre lo sprite viene riportato alla
cella logica di origine. Un altro abitante vede così una cella fantasma
occupata; la discrepanza può durare fino al successivo claim riuscito.

Il nuovo `stopAndReconcile` termina il runner e, **solo quando il movimento
era ancora attivo**, tenta di riportare la prenotazione alla cella logica
con il callback atomico già esistente del genitore. Se un altro abitante
possiede ora quella cella, il renderer libera la propria vecchia
prenotazione, senza sottrarre la cella all'altro. Quando il nuovo percorso
inizia su una cella diversa da quella logica precedente, libera anche la
vecchia prenotazione; non forza una prenotazione esclusiva della nuova
partenza perché case e ingressi possono essere condivisi. Il risveglio
applica la stessa regola di rilascio in caso di claim fallito. Disabilitare
il girovagare libero ora arresta un passo già in corso e riconcilia
l'occupazione. I segmenti consecutivi continuano a non fermare lo sprite.

La suite `native-resident-occupancy-handoff.test.ts` usa **200 runner
reali** e la stessa classe di occupazione locale della scena A/B, con
**20 cicli** di interruzioni (4.000 handoff), frame bus condiviso, pause,
velocità 1×/2×/4×, callback RAF obsolete, fallimento di claim per
occupazione concorrente, origine cambiata e assenza di prenotazioni
fantasma. Un test di confine verifica che soltanto il renderer nativo
adotti la riparazione. Sono prove Node con RAF simulato, non una partita
completa, una misura FPS o una verifica fisica di hitbox.

Limite residuo: se un altro residente occupa già la cella logica al
momento dell'interruzione, la prenotazione precedente viene liberata ma
il renderer può temporaneamente condividere visivamente la cella;
risolvere un conflitto di posizione richiederebbe una decisione del
pathfinder del genitore, fuori da questa correzione. Nessuna modifica a
GameContext, salvataggi, web, #298 o regole di collisione. Validare CI
e poi la prova A/B su Android/iPhone prima di qualsiasi merge.


## 28 ottobre — arrivo alla casa condivisa senza prenotazioni fantasma

Audit del ramo native: nell'ultimo segmento `commutePurpose === "home"`
il tentativo di claim della cella d'ingresso e' intenzionalmente non
bloccante, perche' piu' residenti possono condividere la stessa casa.
Se il claim falliva, il residente manteneva prenotata la precedente
cella stradale anche **dopo** l'arrivo, fino a un eventuale effetto
successivo di rientro in casa. Se il claim riusciva, conservava invece
un'esclusiva sulla cella d'ingresso condivisa. Entrambi i casi potevano
bloccare altri residenti.

Ora il callback di arrivo dell'**ultimo** segmento verso casa libera
sempre la prenotazione del residente **prima** di notificare
`onCellSettled` e `onCommuteComplete`. Non cambia i claim dei segmenti
intermedi, ne' quelli verso lavoro, bar, culto e altre destinazioni.
La cella stradale rimane riservata durante il movimento e viene
liberata soltanto all'arrivo; un home owner esistente non viene rimosso.
La riparazione e' confinata a `MapWandererCharacter.native.tsx`
e all'helper puro `nativeResidentReleaseSharedHomeArrival`.

Test: claim fallito e riuscito, preservazione dei claim non-home,
ordine delle callback, 200 runner reali del motore con 20 case condivise
per 12 cicli (2.400 arrivi), pausa/background e velocita' 1x/2x/4x,
verifica delle due mappe di occupancy e assenza di celle stradali
fantasma. I runner e le celle sono **simulati in Node**: non sono
prove di pathfinding, rendering React Native montato o FPS su hardware.
La fixture A/B della #298 e il web rimangono invariati. Il nuovo
test e' eseguito dal job gia' presente
`native-resident-occupancy-handoff.test.ts`; i bundle JS e la CI
restano verifiche distinte.
