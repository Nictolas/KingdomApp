# MyKingdom — resilienza del dispatcher RAF nativo ai guasti del bridge (29 ottobre 2026)

## Perimetro e problema

Intervento **solo** nella Draft #297, sopra #296. Nessuna modifica alla PR #295 (marker baseline), alla PR #298 (A/B con sprite reali pre-#297), alla PR #294 (Phaser web), a GameContext, salvataggi, IA, tempi di gioco o distribuzione.

Il dispatcher RAF nativo già isolava gli errori dei singoli residenti e manteneva una sola richiesta RAF per 200 sottoscrittori. Rimaneva però un caso di errore doppio: durante un frame un residente poteva lanciare un'eccezione, e la successiva registrazione RAF nel blocco `finally` poteva fallire a sua volta. L'errore del bridge **sovrascriveva quello originale del residente**. In caso di crash/report diagnostico, il difetto iniziale poteva quindi scomparire.

La correzione distingue il primo errore di callback dal guasto di riarmo e applica la stessa precedenza già presente nella coda dei timer nativi: **errore originale del residente > errore del riarmo**. Se nessun residente fallisce, l'errore del bridge viene propagato. Anche i valori lanciati falsy (`null`, `0`, `false`, stringa vuota) restano osservabili.

## Diagnostica e recupero

Lo snapshot locale `getNativeResidentFrameBusSnapshot()` espone tre contatori cumulativi aggiuntivi:

- `platformRequestFailures`: registrazioni native RAF fallite, comprese le richieste che il bridge potrebbe aver già accodato prima di lanciare.
- `platformCancelFailures`: cancellazioni native RAF fallite durante unmount o pausa/background.
- `postDispatchRearmFailures`: sottoinsieme dei guasti di registrazione avvenuti **dopo** il dispatch di un frame, durante il riarmo.

I contatori non contengono ID di residenti, coordinate, percorsi o dati personali; non sono FPS, latenze o misure del thread UI/GPU. Il pannello __DEV__ li include come **delta della finestra di 10 secondi** nel report JS esportabile soltanto tramite condivisione volontaria dell'operatore; non vengono trasmessi o salvati automaticamente. La baseline #298 non ha bisogno di questi campi aggiuntivi: il parser A/B ignora i campi non richiesti, senza considerarli equivalenti a zero. Una registrazione fallita lascia la coda logica e le sottoscrizioni intatte: una successiva registrazione o chiamata `setActive(true)` può riprovare. Le callback del sistema operativo consegnate in ritardo sono scartate tramite il generation token. **Non è stato aggiunto un loop di retry automatico**, che potrebbe consumare CPU durante un guasto permanente del bridge.

## Test deterministici

`npx tsx --test tests/native-resident-raf-rearm-fault.test.ts`

La nuova suite copre:

1. 200 sottoscrittori persistenti: eccezione `null` di un residente contemporanea al fallimento del riarmo, prosecuzione degli altri 199, preservazione del primo errore e recupero successivo.
2. 200 callback one-shot: eccezione `0`, callback programmata per il frame successivo, fallimento del bridge, consegna di callback OS obsolete e recupero senza duplicazioni.
3. Guasto del solo bridge con valore `false`, nessuna perdita di sottoscrizioni e recupero dopo una nuova registrazione.
4. Cancellazione fallita durante unmount e pausa, contatori corretti, nessuna esecuzione di callback stale, primo frame al resume.
5. 120 frame × 200 residenti con otto guasti di riarmo iniettati: un solo RAF vivo, nessun callback residente perso o duplicato, pulizia completa finale.

La suite è parte di `Native Performance Diagnostics Tests`, insieme ai test già esistenti di lifecycle, timer, collisioni, occupazione, sprite e ai bundle JS Android/iOS/web. La CI generale TypeScript può restare rossa per errori preesistenti del repository: distinguere sempre quel gate dalla suite nativa.

## Limiti e prove mancanti

I test usano un bridge RAF fittizio in Node, non un dispositivo. Non provano la correttezza del driver RAF reale, la latenza del tocco, gli FPS del thread UI/GPU, la stabilità termica o l'uso della memoria. Per un confronto con sprite reali serve **#298 vs #297** sullo stesso Android e sullo stesso iPhone, con build identificabili per commit, 25/50/100/200 residenti, velocità 1×/2×/4×, tre acquisizioni indipendenti per scenario e test manuali di pausa/background, tap/doppio tap, collisioni, pan/zoom, cambio percorso e occupancy. Nessun merge o rilascio automatico.
