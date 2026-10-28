# Sperimentazione: movimento residenti senza rerender React per ogni pixel

> PR sperimentale **stacked** sopra la baseline diagnostica mobile #295.
> Non e' una misurazione di prestazioni e non deve essere fusa senza prova reale.

## Ipotesi e modifica

Il vecchio `MapWandererCharacter` chiamava `setPixelPos({x,y})` da ogni `requestAnimationFrame`. Con 200 personaggi in movimento, queste chiamate possono causare molte invocazioni di render React. Questa sperimentazione mantiene **gli stessi 2 percorsi RAF** (passeggiata e pendolarismo), la stessa durata dei passi e gli stessi callback di occupazione delle celle, ma sostituisce lo stato React per la posizione con un `Animated.ValueXY` persistente per personaggio.

- `pixelPos.setValue({x,y})` viene applicato ai layout `left/top` dei componenti animati, senza richiedere reconciliation React per ciascuna variazione di pixel.
- Lo sprite cliccabile usa `Animated.createAnimatedComponent(Pressable)`, affinche' l'area di tocco si sposti con il personaggio; gli sprite non interattivi usano `Animated.View`.
- Direzione, frame della camminata, arrivo e occupazione continuano ad aggiornare lo stato e le callback esistenti.
- Non si usa `useNativeDriver: true`: `left/top` non sono supportati dal driver nativo per animazioni in layout. Il calcolo resta sul thread JS e va misurato su hardware.
- Nessuna modifica ai salvataggi, alla gestione della popolazione, agli orari, alla durata dei passi, alle collisioni o all'IA.

## Protocollo A/B

1. Su **stesso dispositivo fisico** e stessa partita, misurare #295, poi questa PR con lo stesso protocollo e un ordine alternato nelle ripetizioni.
2. Annotare **FPS JavaScript, p95, callback animazione abitanti/s e invocazioni React abitanti/s**, separando unita' ferme, una popolazione mista e molti residenti in movimento.
3. Verificare visivamente e con tocchi: animazione, hitbox del personaggio durante il movimento, doppio tap, entrata negli edifici, occupazione e rilascio delle celle, pause e accelerazione del tempo.
4. Monitorare l'eventuale aumento della memoria e dei tempi di tocco. Valutare anche FPS del **thread UI** con strumenti della piattaforma.
5. Il fatto che il numero di invocazioni React diminuisca non garantisce un incremento degli FPS; la metrica va confrontata con il baseline e non presentata come miglioramento effettivo senza risultati.

Il benchmark Phaser web #294 e' distinto e **non** utilizzabile per validare questa ottimizzazione React Native.

## Correzione della pausa delle animazioni

La precedente logica di movimento usava `(performance.now() - start)` per entrambi i tipi di passo, anche quando la pausa di gioco sospendeva il movimento: un residente poteva quindi completare improvvisamente il passo alla ripresa. Ora `PauseAwareMotionClock` esclude dalla durata del segmento le finestre di pausa e conserva lo stesso frame della camminata. Test automatici verificano pausa lunga, ripresa, timestamp non validi e segmenti indipendenti.

Questa correzione e' **funzionale**, non un guadagno FPS e non deve essere interpretata come benchmark. Per confrontare esclusivamente l'ottimizzazione `Animated.ValueXY`, non usare le pause durante la finestra di misurazione, perche' il ramo sperimentale contiene anche questa correzione. Verificare comunque manualmente che pausa/ripresa non teletrasportino e che la durata dei passi resti coerente.

## Correzione dell'attesa per collisione durante pausa

La revisione di `MapWandererCharacter` ha identificato un caso concreto: quando un tragitto viene bloccato da una cella occupata, `runOneSegment` prepara un nuovo tentativo tramite `idleTimerRef`. La pausa globale annulla quel timer con `clearIdle()`, ma al resume il precedente effetto ignorava tutti i tragitti attivi: il personaggio poteva **rimanere bloccato indefinitamente**.

Il ramo sperimentale ora:
- Trattiene la continuazione del segmento in `PendingCommuteRetry` quando la cella e' occupata o l'orologio e' in pausa.
- Non richiede celle e non avvia passi mentre il tempo di gioco e' fermo.
- Quando la pausa comincia, annulla il timer senza scartare la continuazione; alla ripresa tenta il segmento **una sola volta** senza ricominciare da casa.
- Scarta la continuazione se il tragitto cambia o il componente viene smontato, evitando che un vecchio tentativo interferisca con un percorso nuovo.
- Conserva l'attesa `CLAIM_RETRY_MS` negli scenari senza pausa e la logica esistente del numero massimo di tentativi.

I test puri verificano recupero, consumo singolo, invalidazione del vecchio tragitto e sostituzione del tentativo. **Non costituiscono ancora una prova end-to-end delle collisioni su dispositivo fisico**. La convalida manuale deve riprodurre due residenti sulla stessa strada, pausa durante la coda, ripresa, avanzamento e collisioni residue.

## Isolamento web e native (28 ottobre)

L'audit successivo ha rilevato che la prima implementazione dell'esperimento aveva cambiato `MapWandererCharacter.tsx`, componente condiviso anche dal web. La modifica e' stata **spostata integralmente** in `MapWandererCharacter.native.tsx` per Android e iOS; il componente standard `MapWandererCharacter.tsx` e' tornato **identico al contenuto della baseline #295**.

L'import in `app/mappa.tsx` rimane senza estensione, consentendo al resolver di Metro di scegliere il file specifico della piattaforma. Un test di regressione verifica separazione, parita' dei props e import. La CI esegue i bundle Android, iOS e **web**; solo il loro esito fornisce evidenze di compilazione, non prestazioni o comportamento su smartphone. Questa PR resta Draft e non deve modificare la versione web.

## Velocita' 1x/2x/4x e ripresa dell'app

L'audit dei passi native ha evidenziato che la durata reale rimaneva fissa a 1000 ms (750 ms su strada) anche quando il mondo simulato scorreva a 2x o 4x. Il renderer native-only ora legge `getOrologioSimTimeScaleSnapshot()` a ogni RAF e integra il progresso dell'animazione al rate corrente. Una transizione 1x → 4x o 4x → 2x **non azzera ne' completa istantaneamente** il passo; la durata di riferimento rimane la stessa in millisecondi simulati. In pausa (rate 0), il progresso rimane fermo.

Per evitare scatti dopo aver messo l'app in background, `PauseAwareMotionClock` scarta un intervallo RAF sospeso pari o superiore a 2000 ms invece di tradurlo in uno spostamento istantaneo del personaggio. **Non modifica il timer del mondo ne' i salvataggi.** Test automatici coprono progressione 1x/2x/4x, cambi di velocita' nel mezzo del passo, pausa, timestamp invalidi e lunghi gap di background.

Questa correzione non modifica la versione web e non prova un aumento degli FPS. Per il confronto A/B di `Animated.ValueXY`, misurare i due rami esclusivamente a **1x**; i test funzionali 2x/4x restano obbligatori separatamente. Il timer d'attesa tra passeggiate casuali rimane invariato: una eventuale accelerazione degli idle timer va valutata come altra modifica di gameplay, non mascherata da ottimizzazione grafica.

## Intervento ampio: frame bus condiviso per 25–200 residenti (28 ottobre)

Fino a questa modifica, ogni personaggio mobile con un passo in corso registrava un proprio `requestAnimationFrame`, potenzialmente 200 richieste RAF per ogni fotogramma. In questa PR, solo sul renderer **React Native**:

1. `NativeResidentFrameBus` raggruppa le richieste in un solo RAF di piattaforma. Tutti i residenti ancora attivi vengono aggiornati nello stesso tick e ricevono lo stesso timestamp. Le callback per-residente rimangono indipendenti, per preservare percorsi, collisioni, pause e tempi.
2. La cancellazione rimane individuale: l'uscita di un personaggio annulla soltanto il suo callback. Se non resta nessun residente in movimento, il bus cancella la richiesta RAF della piattaforma; quando un nuovo movimento comincia, la riattiva.
3. Se una callback del lotto annulla quella di un altro residente, il secondo viene saltato. Le nuove richieste fatte dentro un tick partono dal **fotogramma successivo**, non da quello corrente. Un'eccezione di un singolo residente non impedisce che gli altri vengano aggiornati nello stesso tick.
4. `MapWandererCharacter.native.tsx` usa il bus nei due percorsi (passeggiata e pendolarismo), inclusi tutti gli annullamenti al cambio tragitto, notte, casa e smontaggio. L'ottimizzazione riguarda solo Android/iPhone; **web non importa il bus**.
5. La camminata cambia sprite circa ogni 180 ms, non ogni RAF: un gate confronta il fotogramma corrente e chiama `setWalkFrame` soltanto quando cambia effettivamente.
6. L'HUD separa **callback abitanti/s**, **invocazioni React abitanti/s** e **frame bus nativo/s** per rendere visibile l'effetto delle ottimizzazioni, senza salvare o inviare dati.

### Prove ripetibili

`tests/native-resident-frame-bus.test.ts` usa un RAF finto controllabile; lo scenario di 200 residenti per 120 fotogrammi deve eseguire **24.000 callback residenti usando solo 120 richieste RAF di piattaforma sintetiche**, senza perdita o duplicazione di callback. Sono anche coperti: cancellazioni prima del tick, cancellazione tra callback dello stesso lotto, nuovo movimento nel tick successivo, errore isolato, nessun lavoro quando tutti i residenti sono fermi. Il test del confine native/web controlla che il web non sia interessato e che gli aggiornamenti di sprite siano condizionati ai cambi reali.

Questi valori **sono proprietà deterministiche del dispatcher su un RAF finto**, non una misura di FPS, CPU, energia, memoria o maggiore fluidita' su un dispositivo. Per misurare benefici reali, comparare baseline PR #295 con questa PR su *identico* smartphone, stessa scena e stessa velocita' 1×: quantificare FPS JS, p95, callback/s, bus/s, invocazioni React/s, FPS UI/GPU, tap, pinch, collisioni, pause e batteria. Non fondere prima del confronto manuale.

## Sospensione condivisa di tutti i residenti: pausa e background (28 ottobre)

Il primo frame bus raggruppava le richieste RAF, ma continuava a processare ogni abitante anche durante una pausa; con 200 residenti in movimento questo produceva comunque 200 callback JS per fotogramma inutili.

### Correzione strutturale

- `NativeResidentActivityGate` combina due condizioni indipendenti: orologio di gioco **non in pausa** e stato app **in primo piano**. Se manca anche una delle due, il frame bus diventa inattivo. Tornare in primo piano **non** rimuove una pausa manuale.
- `nativeResidentFrameLifecycle.native.ts` sottoscrive una volta sola (per l'intero runtime JS, non per ogni residente) gli eventi di pausa e `AppState` su Android/iOS.
- `NativeResidentFrameBus.setActive(false)` annulla il RAF condiviso e **conserva in memoria tutti i callback dei residenti pendenti**. Nuovi callback richiesti mentre l'app e' sospesa vengono messi in coda senza richiedere fotogrammi. Se 200 residenti stanno camminando e l'orologio viene messo in pausa, ci sono **zero RAF di piattaforma pianificati dal bus** finche' il gioco rimane fermo (verifica sintetica, non un profiler del sistema intero).
- `setActive(true)` riparte con **un solo RAF**: in quel primo tick i residenti ricevono il flag `resumedAfterSuspension` e aggiornano la base del tempo con scala 0; non avanzano la posizione. Dal tick successivo riprendono alla velocita' corrente 1×, 2× o 4×. Questo evita salti anche per pause brevissime inferiori alla soglia dei gap RAF.
- Una pausa che interviene dentro una callback interrompe il lotto e conserva quelli non ancora elaborati. Un callback nativo vecchio, consegnato nonostante l'annullamento, e' ignorato grazie a un identificatore di generazione; non puo' eseguire per errore il lotto del frame nuovo.
- I callback vengono rimossi singolarmente a cambio tragitto, immobilizzazione o unmount; l'ultimo residente fermo libera il RAF. Nessun timer di polling e nessuna modifica a `GameContext`, orologio globale, AI, salvataggi o renderer web.

### Test automatici e limiti

`native-resident-frame-bus.test.ts` verifica 200 residenti in pausa, nessun RAF durante la sospensione, resume con clock rebase, cancellazioni e unmount durante la pausa, callback vecchi che arrivano in ritardo, interruzione del lotto in mezzo al tick e idempotenza delle transizioni. `native-resident-activity-gate.test.ts` verifica gli incroci fra pausa manuale e foreground/background, inclusi 200 aggiornamenti ridondanti.

Questi sono test **deterministici**, non una misura di CPU, FPS, memoria o batteria sul telefono. Resta necessaria la prova nativa manuale: con almeno 50 residenti in movimento verificare (1) pausa 0.2 s e 10 s, (2) ritorno in foreground dopo 30 s, (3) movimenti 1×/2×/4×, (4) collisioni e attese a un incrocio, (5) tap/doppio tap sugli abitanti animati, (6) zoom e panoramica; poi ripetere con 100 e circa 200. Utilizzare il pannello prestazioni e un profiler del thread UI per confrontare la PR #295.

Questa correzione non e' stata rilasciata: PR Draft #296, stacked su #295.
