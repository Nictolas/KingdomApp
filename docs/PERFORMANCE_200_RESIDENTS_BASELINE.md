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

## Seconda fase: stress test del renderer con 200 sprite
- La URL tecnica `/mappa-phaser-preview?perf=1&residents=200` apre direttamente la mappa in **sola lettura**, senza avviare una partita, cancellare salvataggi o creare abitanti nel GameContext.
- `src/phaser/adapters/phaserResidentsBenchmarkFixture.ts` genera **200 personaggi Phaser**, ognuno con uno sprite Golem e una sequenza ripetuta di movimenti. Il renderer crea i veri GameObject e le animazioni/tween della scena web, anziché limitarsi a controllare coordinate.
- `scripts/phaser-perf-benchmark.mjs` misura idle, pan e zoom su questa URL e **fallisce esplicitamente** se i contatori non confermano 200 personaggi nello snapshot **e** 200 sprite istanziati; in caso di errore di avvio allega diagnostica console e corpo pagina.
- La prova misura un carico di **rendering e animazione**, **non** 200 abitanti reali con bisogni, IA, routine di lavoro, pathfinding, salvataggio o asset LPC multilayer. Tutte le rappresentazioni usano lo stesso spritesheet Golem. Non può dimostrare le prestazioni della simulazione completa e non sostituisce Android/iPhone.
- La rotta benchmark non viene utilizzata per il gameplay e non stabilisce un cap di popolazione.

## Esecuzione e interpretazione

1. Eseguire `npm ci`, `npm run typecheck` e `npm test`.
2. Per il benchmark web esistente usare il workflow **Phaser Performance Benchmark** oppure `node scripts/phaser-perf-benchmark.mjs` dopo la build e l'avvio del server locale richiesti dal workflow.
3. Leggere **tutti e tre** i conteggi abitanti con gli FPS. Ora il benchmark richiede 200 personaggi **renderizzati**; non rappresentano una popolazione di 200 NPC con IA. Se il benchmark non carica la scena o non raggiunge 200 sprite, segnalarne il fallimento anziché pubblicare FPS non validi.
4. Per un test autentico con 200 abitanti occorrono una partita/fixture effettiva con 200 NPC e misure su smartphone Android e iPhone. Il test sintetico di culling verifica solo la selezione delle posizioni; **non esercita** IA, lavoro, movimento e pathfinding simultanei, creazione di sprite LPC multilayer, memoria, alimentazione, né prestazioni termiche del dispositivo.

## Matrice di prova mobile da completare

Verificare almeno: mappa ferma, pan continuo, zoom ripetuto, molti abitanti in movimento, abitanti concentrati nella stessa area, ritorno da schermate edifici, pausa/offline e ripresa. Per ogni prova registrare dispositivo, numero reale abitanti nello snapshot, sprite creati/visibili, FPS medi, p95 dei frame, memoria osservata, blocchi e anomalie grafiche. **Non dichiarare raggiunto il target di fluidità prima di tali prove.**

## Vincoli di progetto preservati

La diagnostica è attiva soltanto nella modalità di benchmark già esistente. Non introduce né approva un tetto di 200 abitanti, non cambia velocità del tempo, scelte NPC, rendering normale, meccaniche militari, salvataggi, multiplayer o federazione. Le formule militari restano da definire secondo il Google Sheet; **Q253 sulle sanzioni internazionali rimane aperta e non approvata**.

Questo ramo non deve essere fuso o distribuito prima di verificare la CI e l'integrazione con gli altri rami ancora Draft.
