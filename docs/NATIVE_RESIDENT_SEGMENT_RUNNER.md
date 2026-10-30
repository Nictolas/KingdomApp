# MyKingdom — unificazione del movimento nativo degli abitanti

**Ramo:** `perf/native-resident-timer-batching-20261028` (PR Draft #297, stacked su #296 → #295).
**Ambito:** solo `MapWandererCharacter.native.tsx` e codice puro sotto `src/performance`. Nessuna modifica al renderer web, alle regole di movimento, a `GameContext`, ai salvataggi, alle collisioni, ai dati degli utenti o alla produzione.

## Perché questo intervento

Nel renderer nativo esistevano due cicli RAF quasi identici, uno per la passeggiata e uno per il tragitto verso lavoro/casa/altro: entrambi calcolavano il progresso, scrivevano `Animated.ValueXY`, avanzavano i fotogrammi e gestivano la sospensione. La duplicazione rendeva facile correggere un caso e dimenticare l'altro. Inoltre entrambi scrivevano **due volte la posizione finale** quando un segmento terminava (interpolazione a `t=1` seguita dallo snap alla stessa coordinata).

`NativeResidentSegmentRunner` centralizza questi comportamenti in una classe TypeScript pura e iniettabile. Non pianifica i percorsi, non controlla l'occupazione, non modifica l'IA: il componente conserva esattamente le stesse scelte di cella, la durata strada/non-strada (750/1000 ms), l'attesa idle (2200 ms), il retry collisione (900 ms), il limite di tre fallimenti, l'eccezione di ingresso condiviso a casa, le callback di arrivo e le etichette/tocchi.

## Contratto del runner

- `start({from,to,durationMs,startTimestamp,onArrival,keepWalkingOnArrival})` valida coordinate e durata e avvia un segmento. Una sostituzione esterna annulla la sottoscrizione precedente; una continuazione **sincrona da `onArrival`** riutilizza invece il medesimo dispatcher persistente senza rieseguire subscribe/cancel. Una nuova continuazione non avanza fino al RAF successivo.
- `cancel()` invalida un token di generazione e cancella il frame pendente. Una callback nativa già consegnata ma obsoleta non può scrivere coordinate né completare il segmento.
- Ogni tick usa `NativeResidentSegmentProgress`, già basato su `PauseAwareMotionClock`, e legge la velocità **corrente** (1×/2×/4×). La prima callback dopo una sospensione aggiorna solo la base temporale; non recupera il tempo offline.
- Per frame valido si scrive al massimo una posizione; se la posizione interpolata è identica alla precedente, non si invia un aggiornamento duplicato. L'arrivo a `t=1` produce una sola scrittura, non due.
- La passeggiata ferma l'animazione all'arrivo; i segmenti intermedi di un tragitto mantengono la camminata continua e ripartono dal primo fotogramma. Il componente conserva le notifiche di cella, la logica di claim e il passaggio al segmento successivo.
- Le callback di completamento possono iniziare **sincronicamente** un nuovo segmento: il runner non deve sovrascrivere il nuovo ID RAF o chiamare due volte l'arrivo.
- Nessun timer OS aggiuntivo: al massimo una sottoscrizione logica RAF per residente **mentre cammina**, zero quando è fermo. Nessun dato persistente o personale. I contatori diagnostici sono aggregati e locali.

## Verifiche automatiche

`tests/native-resident-segment-runner.test.ts`:
1. Interpolazione e cambi 1×→2×→4×, arresto con scala zero, una sola scrittura finale, callback una volta.
2. Cancellazione e callback OS obsoleta: nessuna scrittura o arrivo del vecchio segmento.
3. Quattro segmenti commute concatenati sincronicamente: continuità della camminata, ordine delle notifiche, un solo RAF di piattaforma e **una registrazione per residente** attraverso i quattro segmenti.
4. **200 residenti** su un solo bus RAF, 60 tick, sospensione app, pausa manuale, ripresa senza teletrasporto, 50 cancellazioni in corsa, velocità 1×/2×/4×, completamento dei 150 rimanenti.
5. **5.000 sostituzioni** consecutive del segmento, al massimo un frame OS pendente e validazione che un input errato non annulli il movimento valido.

`tests/native-resident-sprite-scheduler-integration.test.ts` usa ora il **runner effettivo**, non una sua imitazione, insieme a 200 `NativeResidentSpriteFrameDriver`, `NativeResidentFrameBus`, `NativeResidentTimerQueue` e `NativeResidentActivityGate`. Controlla pause, frame obsoleti, tre durate di passo, 50 retry annullati e 150 retry eseguiti senza duplicati. Il test di confine `native-resident-platform-boundary.test.ts` garantisce che i due percorsi nativi usino il runner e che il web non lo importi.

**Importante:** queste sono prove logiche sintetiche su Node. I contatori di callback e le scritture duplicate rimosse NON sono misure di FPS, latenza touch, CPU o batteria su dispositivi Android/iOS.

## Verifica manuale prima di qualsiasi merge

Su **Android e iPhone reali**, confrontare PR #295 (baseline), #296 (bus RAF) e #297 (timer e runner) con 25, 50, 100 e 200 abitanti vivi. Per ciascuna popolazione, provare movimento libero, percorso casa→lavoro→casa, strada e terreno, 1×/2×/4×, pausa breve/lunga, background/foreground, collisione tra due abitanti e cella casa condivisa. Toccare un abitante in movimento (tap e doppio tap), zoomare/spostare la mappa, e controllare che non vi siano salti di posizione, animazioni ferme, arrivi doppi o tocchi disallineati. Misurare con gli strumenti della baseline il tempo di frame JS/UI e le distribuzioni di latenza; non dedurre FPS dai test Node.

**Rischio principale:** un refactor del percorso RAF potrebbe introdurre regressioni di interazione tra callback di arrivo e claim della cella. La suite automatica verifica l'ordine e la cancellazione, ma non sostituisce il playtest di collisione e tocco reale. Il cambiamento resta isolato nella PR Draft, senza merge o release.


## 29 ottobre — 4×: riduzione delle registrazioni durante tragitti lunghi

Con 200 abitanti e 12 celle percorse ciascuno, il vecchio runner
registrava 2.400 callback persistenti (una per cella); la versione
candidata registra una callback per abitante **se la catena di segmenti
è immediata**, pari a 200 registrazioni nel modello sintetico.
La riduzione strutturale prevista è quindi 2.200 operazioni di
registrazione, oltre alle relative cancellazioni. Gli aggiornamenti
`Animated.ValueXY`, il numero di frame, le durate delle celle, le
decisioni d'occupazione e le notifiche di arrivo rimangono identici.

Un dispatcher stabile del runner inoltra ogni frame al segmento
corrente. L'`onArrival` può sostituire il segmento sincronicamente:
il dispatcher conserva l'ID del frame bus, mentre un token di
generazione invalida il vecchio segmento. Una route modificata da
fuori dall'`onArrival` usa il normale cancel/re-subscribe, preservando
la regola che un subscriber nuovo non viene processato nello stesso
frame. Una `onArrival` terminale o che lancia eccezione libera
l'iscrizione in `finally`.

`tests/native-resident-4x-subscription-reuse.test.ts` copre 200
runner reali, 12 passi a 4×, 80 secondi di background simulato,
cambi 1×/2×/4×, assenza di RAF orfani e callback terminali fallite.
Una prova di **equivalenza per ogni frame** esegue due gruppi separati
di 200 runner di produzione, uno con la vecchia API RAF one-shot e uno
con il dispatcher persistente: confronta ad ogni frame coordinate
interpolate, ordine/conteggio degli arrivi e pixel della sprite-sheet,
compresa una sospensione prolungata. Il confronto è sintetico e
dimostra il numero di iscrizioni e la parità logica, **non** FPS o
performance fisiche misurate su Android/iPhone.


## 29 ottobre — isolamento delle eccezioni durante 200 animazioni a 4×

Audit del runner: il frame bus nativo già intercettava l'eccezione di un
subscriber e proseguiva il dispatch agli altri 199, ma il segmento di
quel subscriber poteva **restare attivo e rischedulato**. Un writer
`Animated.ValueXY`, una notifica di frame, il driver del costume o una
callback di inizializzazione difettosa avrebbero quindi potuto ripetere
lo stesso errore su tutti i RAF successivi. A 4× il problema non
deve propagarsi a un carico persistente sul thread JavaScript.

Il runner ora distingue il caso di errore dal percorso ordinario:

- Durante `start()`, un'eccezione nel callback di cammino,
  nell'azzeramento del fotogramma o nella registrazione RAF provoca
  un rollback del segmento, senza cancellare una route più recente.
- Un'eccezione durante un tick RAF invalida immediatamente il token
  corrente e libera la sottoscrizione persistente o one-shot prima
  di rilanciare l'errore al bus. Il bus continua a servire gli altri
  residenti; il vecchio segmento non consuma più frame.
- `cancel()` elimina il proprio riferimento prima di invocare
  la cancellazione di piattaforma, così una callback/bridge che
  genera eccezione non lascia un ID falsamente ancora posseduto.
- L'errore originario non è nascosto da un'eventuale seconda
  eccezione nel callback che prova a fermare l'animazione. La procedura
  prova a fermare il costume anche se il runner ha già posto
  `active=false` per un arrivo: una eccezione al reset terminale
  del fotogramma o del flag `setWalking(false)` non deve lasciare
  la sprite visivamente in cammino.
- Se il callback difettoso **ha già avviato una nuova route** prima
  di generare l'errore, il controllo di generazione impedisce
  di cancellare la nuova animazione.

La modifica è limitata a `NativeResidentSegmentRunner`; nessuna
decisione di percorso, velocità, cella, salvataggio o GameContext è
stata modificata. Il percorso senza errori non aggiunge timer o
sottoscrizioni. Il nuovo `try/catch` dentro il frame callback
protegge le eccezioni; il suo eventuale overhead va ancora
verificato con il confronto su dispositivi fisici.

La nuova suite `tests/native-resident-fault-isolation.test.ts`
esegue quattro classi di scenari sintetici: 200 runner con
15 avvii falliti controllati; 200 runner a 4× con 20 errori
durante la scrittura delle coordinate, pausa/background e
ripresa degli altri 180; sostituzione rientrante del percorso
prima di un errore del callback originale; e 200 arrivi
sincroni con dieci callback terminali che lanciano eccezioni.
Invarianti: nessuna sottoscrizione orfana, nessun arrivo
fantasma, nessun residente sano bloccato da un altro e
nessuna nuova route cancellata dal vecchio token.

Questi test usano timer/RAF **finti in Node**: non dimostrano
la frequenza reale delle eccezioni, FPS, uso CPU, GC, batteria
o comportamento del bridge React Native su Android/iOS.
La pipeline nativa deve essere verde e la scena #298/#297
va misurata su telefoni fisici prima di qualsiasi merge.


**Seconda regressione:** una prova con 200 residenti mescola
100 runner persistenti e 100 con la vecchia API RAF one-shot.
Metà fallisce nel reset terminale della sprite-sheet, metà nel primo
tentativo di disattivazione dello stato `walking`; entrambe devono
liberare tutte le iscrizioni e tornare allo stato visivo fermo.
Gli stessi 200 runner ripartono poi con un segmento pulito e
raggiungono una sola volta la destinazione. È uno stress test Node
a 4×, non una misura delle prestazioni del telefono.
