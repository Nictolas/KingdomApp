# MyKingdom — verifica prestazioni con 200 abitanti (prima fase)

## Scopo

**200 abitanti sono uno scenario di stress da valutare, non un limite di popolazione approvato.**
MyKingdom mira ad Android/iPhone; la versione web serve anche per test, ma non sostituisce misure su dispositivi reali.

## Cosa è stato implementato

- `tests/phaser-200-residents-culling.test.ts` costruisce **200 posizioni sintetiche** deterministiche per verificare che il culling della camera individui solo il sottoinsieme visibile, lo aggiorni dopo uno spostamento e **non cancelli** i personaggi fuori schermo.
- I contatori di diagnostica Phaser ora distinguono:
  - `snapshotCharacters`: personaggi presenti nello snapshot della mappa;
  - `characterViewsTotal`: rappresentazioni grafiche effettivamente istanziate;
  - `characterViewsVisible`: rappresentazioni grafiche nel viewport più margine;
  - `characterViewsChecked`: numero cumulativo di controlli di visibilità dopo il reset, **non** numero attuale di personaggi.
- `scripts/phaser-perf-benchmark.mjs` mostra questi conteggi assieme a FPS, frame p95 e frame lenti per gli scenari già esistenti (idle/pan/zoom). Il JSON `BK017_PERF_RESULTS` continua a contenere anche i contatori `work`.

## Esecuzione e interpretazione

1. Eseguire `npm ci`, `npm run typecheck` e `npm test`.
2. Per il benchmark web esistente usare il workflow **Phaser Performance Benchmark** oppure `node scripts/phaser-perf-benchmark.mjs` dopo la build e l'avvio del server locale richiesti dal workflow.
3. Leggere **tutti e tre** i conteggi abitanti con gli FPS. Se `snapshotCharacters` non raggiunge 200, il benchmark **non misura una popolazione reale di 200 abitanti**: riportarlo esplicitamente.
4. Per un test autentico con 200 abitanti occorrono una partita/fixture effettiva con 200 NPC e misure su smartphone Android e iPhone. Il test sintetico di culling verifica solo la selezione delle posizioni; **non esercita** IA, lavoro, movimento e pathfinding simultanei, creazione di sprite LPC multilayer, memoria, alimentazione, né prestazioni termiche del dispositivo.

## Matrice di prova mobile da completare

Verificare almeno: mappa ferma, pan continuo, zoom ripetuto, molti abitanti in movimento, abitanti concentrati nella stessa area, ritorno da schermate edifici, pausa/offline e ripresa. Per ogni prova registrare dispositivo, numero reale abitanti nello snapshot, sprite creati/visibili, FPS medi, p95 dei frame, memoria osservata, blocchi e anomalie grafiche. **Non dichiarare raggiunto il target di fluidità prima di tali prove.**

## Vincoli di progetto preservati

La diagnostica è attiva soltanto nella modalità di benchmark già esistente. Non introduce né approva un tetto di 200 abitanti, non cambia velocità del tempo, scelte NPC, rendering normale, meccaniche militari, salvataggi, multiplayer o federazione. Le formule militari restano da definire secondo il Google Sheet; **Q253 sulle sanzioni internazionali rimane aperta e non approvata**.

Questo ramo non deve essere fuso o distribuito prima di verificare la CI e l'integrazione con gli altri rami ancora Draft.
