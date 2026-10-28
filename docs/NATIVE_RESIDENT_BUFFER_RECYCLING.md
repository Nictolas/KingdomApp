# MyKingdom — Riuso dei buffer RAF e timer (native Android/iOS)

## Perché

Con circa 200 abitanti il dispatcher RAF condiviso e la coda dei timeout eseguono molte iterazioni. In precedenza il dispatcher creava un nuovo `Map` a **ogni frame**, anche quando non esistevano callback one-shot; la coda dei timer creava un nuovo `Map` per l'insieme delle scadenze pronte a **ogni wakeup**. Sono allocazioni evitabili sul thread JavaScript e potenziali fonti di lavoro del garbage collector.

Questa modifica è isolata nella PR Draft **#297**, sovrapposta a **#296 → #295**. Non modifica il rendering Phaser web, `GameContext`, salvataggi, occupazione delle caselle, selezione dei percorsi o tempi di gioco.

## Modifiche al runtime

1. **`NativeResidentFrameBus` — due buffer one-shot riciclati.** Il caso prevalente con soli 200 sottoscrittori persistenti non sostituisce più il `Map` vuoto ad ogni RAF. Se ci sono richieste one-shot, lo scheduler scambia due `Map` preesistenti: callback create durante il dispatch finiscono nel buffer del frame seguente. Al termine, se una pausa ha lasciato callback non eseguite, queste mantengono l'ordine FIFO davanti alle richieste create nel frattempo. I buffer sono riciclati, senza crearne un terzo.
2. **`NativeResidentTimerQueue` — buffer delle scadenze pronte riutilizzato.** Lo scheduler estrae al massimo il prefisso previsto dal budget cooperativo (32 callback, massimo *soft* di 6 ms). Il `Map` delle callback pronte è uno solo per istanza e viene svuotato in `finally` dopo aver rimesso in heap quelle non eseguite. Si eliminano le allocazioni ripetute senza trattenere i riferimenti alle callback dopo il wakeup.
3. **Diagnostica aggregata.** `oneShotBufferSwaps` e `readyBufferUses` consentono di verificare quante volte vengono riutilizzati i buffer. Non registrano ID, coordinate, percorsi o dati personali.

## Invarianti da conservare

- Una sola RAF di piattaforma e un solo timeout di piattaforma attivi alla volta.
- Sospensione durante una callback, compresa pausa/ripresa sincrona, interrompe il batch obsoleto.
- Una callback creata durante il dispatch **non** viene eseguita nello stesso batch.
- Cancellazione di una callback già estratta impedisce comunque la sua esecuzione.
- Nessun RAF/timer viene riavviato in background o durante una pausa di gioco; il primo frame dopo il resume ribasa l'orologio di movimento.
- La coda timer continua a rispettare l'ordine delle scadenze e dei numeri di registrazione, senza duplicazioni.

## Test e benchmark sintetici

- `tests/native-resident-buffer-reuse.test.ts`: 200 sottoscrittori persistenti su **2.400 frame**, 200 one-shot su **240 frame**, pausa rientrante con cancellazioni, 200 timer simultanei e 2.000 timer con cancellazioni. Nei test a buffer doppio si confronta anche l'identità effettiva dei due `Map`, non soltanto i contatori.
- `tests/native-resident-stateful-soak.test.ts`: tre seed, ciascuno 1.600 transizioni di pause/background, velocità, timer, animazione e smontaggi con 200 residenti.
- `tests/native-resident-frame-bus-benchmark.ts` e `tests/native-resident-timer-burst-benchmark.ts`: oltre a registrazioni, batch e tempi Node, mostrano il **conteggio analitico** delle allocazioni di `Map` evitate.

| Scenario sintetico | Creazioni transitorie precedenti | Dopo |
|---|---:|---:|
| Solo RAF persistente per 2.400 frame | 2.400 `Map` | 0 `Map` |
| 200 residenti one-shot per 240 frame | 240 `Map` | 0 `Map` |
| 200 timer simultanei, 32 callback per wakeup | 7 `Map` | 0 `Map` |
| 10.000 timer simultanei, 32 callback per wakeup | 313 `Map` | 0 `Map` |

Il valore «dopo» **esclude i buffer iniziali riutilizzati** (due per dispatcher RAF, uno per coda timer). I conteggi sono ricavati dagli algoritmi e dalla loro strumentazione; non sono misure del garbage collector, della memoria residente o degli FPS di uno smartphone.

## Rischi e controlli prima del merge

Il riuso trattiene la capacità interna dei `Map` dopo un carico elevato; può ridurre il churn senza ridurre la memoria di picco. Un confronto su hardware deve confrontare baseline #295 e #297 su **stesso dispositivo**, con 25/50/100/200 abitanti e ripetizioni a 1×, 2× e 4×. Misurare JS frame p95, congelamenti, gestione tocchi, collisioni e almeno una traccia del garbage collector/heap; distinguere le metriche JavaScript dagli FPS GPU/UI thread.

Il workflow `native-perf-diagnostics.yml` verifica test puri, soak, gate TypeScript additivo e bundle JS Android/iOS/web. Non equivale a una build nativa installata. La CI generale rimane indipendente e può fallire sui **53 errori TypeScript della baseline #295**; il gate additivo deve impedire errori nuovi. **Nessun merge o deploy senza esiti della CI e prove manuali.**
