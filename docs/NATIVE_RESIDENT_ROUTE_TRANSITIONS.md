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


## 28 ottobre — collisioni in coda e richiesta di nuovo percorso (solo Android/iOS)

Un segmento intermedio arrivato può lasciare volontariamente lo sprite in stato
«cammina», perché il segmento successivo dovrebbe iniziare subito. Se la cella
successiva è occupata, però, il vecchio renderer lasciava lo sprite in cammino
senza un segmento RAF attivo durante le attese da 900 ms, e anche dopo la
richiesta di ricalcolo del percorso.

Il controller nativo `NativeResidentCollisionRetry` mantiene la soglia
preesistente di **3 claim falliti**, senza cambiare durata del retry, scelta
della destinazione o logica del genitore. Ogni fallimento arresta lo stato
visivo di camminata, ma **non libera la cella logica già raggiunta**: il
tentativo di prenotare la prossima cella non è riuscito. Quando il genitore
dispone di un callback di ricalcolo, la terza collisione lo notifica una
sola volta; un callback tardivo non riattiva il percorso bloccato. Il
controller si azzera all'avvio di un nuovo percorso o al claim riuscito.
Senza callback di ricalcolo, il comportamento rimane quello storico:
continuare a ritentare, non abbandonare silenziosamente il tragitto.

La suite `native-resident-collision-retry.test.ts` copre soglia, assenza
di handler, reset, 200 runner e 12.000 claim falliti sintetici in 20 cicli,
burst cooperativi della timer queue e sospensione/foreground. Il test
verifica anche che il renderer web non importi il nuovo controller.
Questi sono **test Node con clock e RAF finti**, non misure FPS o latenza
di collisione su telefono. Durante la prova A/B reale verificare
visivamente uno sprite fermo in attesa di una cella occupata e la ripartenza
dopo il nuovo percorso, anche dopo pausa e background.


## 28 ottobre — nessun percorso alternativo: fallback nativo senza blocco permanente

La revisione diretta del chiamante `handleCommuteBloccata` in `app/mappa.tsx`
ha confermato un caso reale: per destinazioni diverse da lavoro e casa
(bar, mensa, negozio, culto e simili), se il pathfinder non trova un
percorso valido, il callback ritorna **senza aggiornare la commute**.
La precedente logica nativa della #297 passava in stato
`awaiting-repath` permanente, cancellando il retry e lasciando il
residente fermo anche se la cella si liberava successivamente.

Ora, dopo la terza collisione, la richiesta di ricalcolo viene inviata
**una sola volta**. Prima di chiamare il genitore, il renderer programma
un fallback dopo gli stessi 900 ms gia' previsti per i retry. Se il
genitore completa o sostituisce il tragitto, il cleanup annulla il
fallback e `reset()` invalida eventuali callback obsolete. Se invece
non cambia nulla, `resumeWithoutRepath()` riprende i normali tentativi
ogni 900 ms, **senza ripetere il pathfinding** fino a un nuovo tragitto
o a un claim riuscito. Pausa/background congelano il tempo residuo
tramite la coda condivisa esistente. Non cambia la soglia di tre
collisioni, l'algoritmo di navigazione, l'occupancy o la versione web.

Verifiche automatiche aggiunte: transizione one-shot e callback stale,
200 residenti x 20 cicli x 30 collisioni in fallback (120.000 tentativi
sintetici e 4.000 sole richieste di pathfinding), 200 timer con
pausa/background e 100 sostituzioni di percorso, controllo del
confine native/web. Sono test Node con clock simulato, non misurazioni
FPS, React Native montato o prove fisiche. Su Android/iPhone verificare
anche un ingresso affollato senza percorso alternativo, pausa e
successivo sblocco della cella. Nessun intervento su `app/mappa.tsx`,
GameContext, salvataggi, web, #298, merge o release.


## Protezione dalle callback obsolete di ripianificazione (28 ottobre)

Un fallback programmato a 900 ms puo' sopravvivere come closure gia' consegnata al runtime quando il genitore sostituisce il percorso. Il solo booleano `awaitingRepath` non e' sufficiente: dopo il reset un **nuovo** percorso puo' essere nuovamente in attesa, e la closure del **vecchio** percorso potrebbe risvegliarlo per errore.

Il controller `NativeResidentCollisionRetry` ora incrementa una generazione quando richiede una ripianificazione e quando viene resettato. Il renderer nativo cattura `repathGeneration()` prima di invocare `onCommuteBlocked` e consegna il token a `resumeWithoutRepath(token)`. Solo la generazione corrente puo' riprendere i tentativi sulla vecchia cella. La coda condivisa continua a gestire il delay nominale di 900 ms e la sospensione in background; il token e' un'ulteriore difesa contro callback obsolete gia' estratte o conservate in una closure.

**Regressioni aggiunte:** 200 controller per 40 sostituzioni di percorso (8.000 vecchie callback respinte e 8.000 fallback validi); 200 fallback obsoleti e 200 validi con pausa di background e drenaggio cooperativo a 32 callback per wakeup. Sono prove deterministiche su Node, non FPS, touch o prove Android/iOS reali.

Nessuna modifica a GameContext, salvataggi, web, regole di collisione, intervalli di retry o velocita' 1x/2x/4x. Il ramo #297 resta Draft, stacked su #296; #298 resta il confronto A/B degli sprite reali.


## 29 ottobre — consegna terminale one-shot e niente timer inattivi a tragitto finito

### Problema verificato nel renderer nativo

La callback terminale `stepChain` inviava `onCommuteComplete` e subito
programmava un timer idle da 2.200 ms anche quando `commutePath` continuava
a possedere l'abitante. Al suo scadere `pickNextMove` rilevava il percorso
attivo e non faceva nulla: un timer/callback inutile per ciascun abitante
che conclude un tragitto. Se invece il genitore rimuoveva il percorso,
l'effetto già esistente per `commute → free` cancellava quel timer e
ne programmava uno nuovo. La seconda sorgente di wakeup non serve.

Inoltre, la notifica `onCellSettled` di un arrivo poteva eseguire un
callback rientrante del genitore che invalidava il percorso; il renderer
avrebbe poi comunque chiamato `onDone` senza ricontrollare l'ownership
fra i due callback.

### Correzione confinata a #297

- `NativeResidentRouteEpoch.runIfCurrent(token, callback)` controlla il
  proprietario prima **e dopo** una notifica sincrona. Se il genitore
  invalida la route durante il callback, il vecchio `onDone` non procede.
- La consegna di `onCommuteComplete` è **one-shot** per effetto di percorso;
  l'eventuale sostituzione sincrona non avvia una vecchia continuazione.
- Nessun timer idle viene creato mentre il tragitto è ancora attivo dopo
  la consegna terminale. Il passaggio effettivo da `commute` a `free`
  usa l'effetto `nativeResidentShouldRearmIdle` esistente e mantiene lo
  stesso ritardo nominale di **2.200 ms**, solo quando il movimento libero
  è consentito. `fixed/home`, pause e background non causano nuovi movimenti.
- Non vengono alterati i 900 ms delle collisioni, le occupazioni della
  mappa, il pathfinder, l'orologio, le velocità, le regole o i salvataggi.
- Nessuna modifica a `MapWandererCharacter.tsx` (web) o ai quattro file
  identici della fixture A/B #297/#298.

### Verifiche automatiche

La suite `native-resident-route-epoch.test.ts` verifica 12.000 arrivi
sintetici, di cui 8.000 con invalidazione rientrante, e 8.000 notifiche
terminali con consegna ripetuta e invalidazione del percorso; controlla
anche che il codice nativo non armi un idle timer nel ramo terminale.

`native-resident-full-stack-integration.test.ts` esercita 200
`NativeResidentSegmentRunner` reali, il `NativeResidentFrameBus`, la
`NativeResidentTimerQueue` e il gate pausa/foreground per 18 cicli,
con 3.600 arrivi, 720 sostituzioni sincrone durante la notifica,
360 sostituzioni in movimento, velocità 1×/2×/4× e periodi in background.
Verifica zero timer di retry residui e zero iscrizioni RAF dopo ogni
ciclo. Numeri relativi agli **scenari programmati**, non risultati CI
confermati fino all'esito della pipeline.

**Limiti:** `runIfCurrent` intercetta invalidazioni sincrone della route;
un aggiornamento React differito sarà governato dal normale cleanup
dell'effetto. Test Node con RAF, timeout e orologio simulati non provano
frame rate, touch, consumo CPU/memoria o comportamento Android/iPhone.
Confrontare solo le fixture real-sprite #298 (baseline) e #297 (candidata)
sullo stesso dispositivo, 25/50/100/200 NPC e 1×/2×/4×. Nessun merge o
rilascio autorizzato da queste prove da sole.


**Nota sul cleanup React:** la notifica iniziale di assestamento
(`onCellSettled(start)`) può anch'essa essere rientrante. L'effetto
`commute` non deve uscire anticipatamente dopo quella chiamata:
`stepChain` controlla già la generazione e non avvia il vecchio percorso,
ma React deve comunque ricevere la funzione di cleanup per invalidare
future callback e rilasciare le risorse. Un controllo statico nel test
impedisce di reintrodurre quel ritorno anticipato.


## 29 ottobre — esito CI e isolamento dei gruppi di regressione

La pipeline nativa sul commit `8488c24f` ha completato con successo
il gate TypeScript nativo e i primi due gruppi di test, ma il terzo gruppo
ha segnalato **un test di confine obsoleto** nel controllo dell'arrivo a
casa condivisa: assumeva una finestra fissa di 350 caratteri tra rilascio
della cella, notifica di assestamento e chiamata di completamento.
La nuova protezione `routeEpoch.runIfCurrent` ha aumentato la distanza
testuale senza invertire quell'ordine. I 31 altri test del gruppo erano
verdi. La verifica è stata corretta per cercare il blocco completo,
richiedere esplicitamente la guardia di generazione e preservare
`release → onCellSettled → onDone`. Non è stata rimossa la verifica
della sequenza di rilascio.

La CI generale fallisce già nel typecheck su errori di altri moduli
(`app/castello.tsx`, `app/edifici.tsx`, vecchi test di generazione
ecc.); il controllo TypeScript della pipeline nativa è passato sul
commit precedente. Questo **non** equivale a dichiarare verde il
repository né a correggere i vecchi errori.

Per non nascondere altre regressioni quando fallisce una singola suite
di test Node, il job `native-tests` esegue ora **15 gruppi indipendenti**
con `continue-on-error`, ma un gate finale `if: always()` controlla
`steps.<id>.outcome` di tutti e fallisce il job se uno è fallito o
non è stato eseguito. Il nuovo
`tests/native-perf-workflow-isolation.test.mjs` verifica sia
l'aggregazione a esito negativo, sia il gate A/B e la natura
**solo JavaScript** dei bundle Android/iOS/web.

Questa modifica CI non altera il runtime o le regole di gioco. I risultati
del nuovo commit vanno controllati separatamente; nessun FPS su dispositivo
è stato misurato. Le fixture A/B dei quattro file devono restare identiche
tra #297 e #298, e #298 non deve essere fusa nel progetto.
