# MyKingdom — fault di animazione durante una tratta, recupero occupancy (29 ottobre 2026)

## Problema verificato nell'analisi del codice

Le protezioni native della PR #297 gestivano guasti *durante l'avvio* del segmento e *nel callback di arrivo*. Restava scoperto un evento intermedio: `writePositionXY`, `advanceSprite`, `readTimeScale` o il callback di diagnostica possono sollevare un'eccezione durante un frame **dopo** la prenotazione della destinazione. `NativeResidentSegmentRunner.abortFailedSegment` già annulla correttamente la sottoscrizione RAF, ma la mappa conservava la cella di destinazione benché `cellRef` fosse ancora l'origine. Il residente poteva così bloccare un passaggio senza più camminare.

Questa è una lacuna rilevata tramite il percorso di errore e riprodotta in test sintetici: **non** implica che sia stata osservata su uno smartphone reale.

## Correzione nativa

- La richiesta di un segmento può definire `onFrameFault`, invocato **solo per errori durante il dispatch RAF**, mai da `start()`. L'errore originale viene sempre rilanciato, anche se la callback di recupero fallisce; sono inclusi valori eccezione falsy.
- Il runner invalida prima la proprietà del vecchio RAF. Esegue il recupero soltanto se la generazione rimane quella dell'abort appena completato: una sostituzione sincrona del percorso, anche durante `setWalking(false)`, non può reclamare la nuova cella.
- Il renderer native-only collega il recupero in **girovagare libero** e **tragitto programmato**. Reclama la cella logica originaria (oppure rilascia la destinazione non più valida se l'origine è presa) solo se il movimento ha effettivamente prenotato la destinazione e non ha già pubblicato l'arrivo.
- Nei tragitti programmati vale anche la guardia `routeEpoch.isCurrent`; gli ingressi condivisi a casa con claim negato non vengono trattati come destinazioni riservate.
- Nessuna modifica al percorso felice, nessun lavoro aggiuntivo per frame quando le callback non falliscono, nessun cambio a velocità del gioco, GameContext, salvataggi, renderer web o fixture A/B #298.

## Verifiche automatiche

Il file `tests/native-resident-frame-fault-occupancy.test.ts` verifica un guasto nel writer di posizione su una scena con 200 residenti e 199 callback superstiti; 200 residenti × 18 percorsi = **3.600 movimenti**, 720 guasti iniettati a 1×/2×/4×, pausa/background e ripresa, invarianti delle prenotazioni, callback RAF obsolete, sostituzione sincrona di un percorso e nessuna doppia riparazione nel caso di avvio fallito. I contatori e gli esiti sono sintetici, prodotti da callback OS simulate con Node e non rappresentano dati di un telefono fisico.

Il test viene eseguito nella suite di commute/night della CI nativa, e il controllo del workflow impedisce che venga rimosso inavvertitamente. La baseline A/B reale resta #298 contro #297, da verificare separatamente su Android e iPhone fisici con profiler UI/GPU, touch, collisioni, pause e 25/50/100/200 sprite a 1×/2×/4×. Non eseguire merge o release prima di tale evidenza.
