# MyKingdom — riduzione degli oggetti transitori del movimento nativo (28/10/2026)

## Perimetro
Ottimizzazione sperimentale **solo del renderer nativo Android/iOS** nella PR Draft #297, dipendente da #296 → #295. Nessuna modifica al game design, a `GameContext`, ai salvataggi, alle collisioni, al rendering Phaser web o al comportamento della mappa web. Nessun merge, deploy o release.

## Problema
Per ogni callback RAF di ogni residente, `NativeResidentSegmentProgress.sample()` creava uno snapshot temporaneo `{elapsedMs, progress, advance, complete}`. Il runner poi creava `{x, y}` a ogni aggiornamento della posizione. Nella scena sintetica da **200 abitanti × 240 fotogrammi** si tratta di circa **48.000 snapshot** più quasi altrettanti punti temporanei, indipendentemente dall'ottimizzazione del bus RAF condiviso.

## Modifica completa
1. `NativeResidentSegmentProgress.sampleInto(now, speed, resumed, output)` scrive nello stesso oggetto **di proprietà del chiamante**, senza creare uno snapshot a ogni frame. Il metodo pubblico precedente `sample()` continua a restituire un **nuovo oggetto indipendente** a ogni invocazione, così i consumatori che memorizzano campioni storici non cambiano comportamento. Entrambi utilizzano la stessa logica di progresso e pausa.
2. `NativeResidentSegmentRunner` mantiene un unico buffer di campionamento per residente e gli ultimi valori numerici `x/y` anziché un oggetto punto per frame. Il nuovo writer opzionale `writePositionXY(x,y)` evita di creare un punto temporaneo durante il movimento; il writer precedente `writePosition(point)` continua a ricevere oggetti distinti e conserva compatibilità e semantica.
3. **Solo `MapWandererCharacter.native.tsx`** usa `writePositionXY` e passa ad `Animated.ValueXY.setValue` lo **stesso punto mutabile creato una volta al mount**. Restano invariati i gestori touch, il target del tocco, lo snap delle coordinate, il frame dello sprite e le notifiche di arrivo; l'oggetto viene letto sincronicamente dal metodo `setValue`.

## Invarianti e convalida
- Progressione identica per velocità **1×/2×/4×**, frame duplicati, clock non monotono, sospensione breve e lunga, background/foreground e pausa manuale.
- Il primo RAF dopo il resume **ribasa il tempo senza scrivere posizione** o spostare l'abitante.
- Un cambio tragitto o uno smontaggio durante un callback impedisce al vecchio segmento di inviare `onArrival`.
- 200 residenti con **240 frame** ciascuno: tutti condividono un solo RAF OS, **nessuna nuova allocazione del buffer per frame** e nessuna registrazione RAF per residente a ogni frame.
- Stress di **5.000 cambi di tragitto** e prova del writer legacy, che deve restituire punti indipendenti.
- Test unitari + integrazione: `tests/native-resident-allocation-free-motion.test.ts`; benchmark comparativo: `tests/native-resident-motion-buffer-benchmark.ts` (5 round, 200 residenti, 240 frame) collegati al workflow della PR #297. I risultati devono essere confermati dalla CI, non dedotti dalla sola modifica del codice.

## Conteggi analitici, non FPS
In una sequenza ideale di 200 abitanti × 240 frame, il percorso precedente genera **48.000 oggetti-campione**, più un nuovo oggetto posizione a ogni frame che produce un movimento. Nel percorso nativo aggiornato il motore riutilizza **200 buffer-campione e 200 punti**, creati una volta per residente. Il benchmark emette i valori effettivi della sequenza sintetica ed esegue l'asserzione che la posizione finale sia identica.

I tempi Node eventualmente stampati sono soltanto microbenchmark informativi. Le allocazioni interne a React Native, al motore JS, ad Animated e al bridge **non sono eliminate o misurate** da questi conteggi; non si possono attribuire FPS, cali di CPU, memoria o latenza fisica senza test strumentali su smartphone.

## Validazione hardware ancora necessaria
Installare **build di sviluppo** separate della baseline #295 e della PR #297 su Android e iPhone; non installare sulla produzione. Per 25/50/100/200 abitanti ripetere almeno tre misure da 10 s a 1×, 2× e 4×, con movimento, collisioni, tap, doppio tap, pause, zoom e background/foreground. Rilevare JS frame p95, rendering UI/GPU, heap/GC e i log aggregati; effettuare il confronto con lo stesso telefono, la stessa scena e condizioni equivalenti. La CI non può sostituire questa validazione.

Il gate TypeScript additivo deve rimanere verde senza mascherare la CI generale, bloccata da 53 errori già presenti nella #295. La PR rimane Draft, con nessun merge/deploy finché tutti i gate non sono verificati.
