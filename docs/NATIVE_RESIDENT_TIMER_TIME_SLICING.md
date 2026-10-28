# MyKingdom — limite temporale cooperativo per i timer dei residenti (Android/iOS)

## Motivazione e perimetro

La PR Draft #297 già condivide un solo timer nativo fra tutti gli abitanti, usa un min-heap indicizzato e divide le scadenze simultanee in lotti di massimo **32 callback**. Il limite numerico protegge dalle raffiche con molte callback piccole, ma **non** dal caso in cui ogni callback esegua controlli di collisione o altro lavoro JavaScript costoso: 32 callback da 2 ms monopolizzerebbero il thread JS per 64 ms in un singolo turno, senza dare al runtime la possibilità di elaborare input e altri task.

Questo intervento aggiunge un **budget temporale cooperativo di 6 ms** per il singleton nativo, mantenendo il tetto di 32 callback. La prima condizione raggiunta fa terminare il turno; le callback già estratte ma non ancora eseguite tornano nel min-heap e mantengono deadline/ID. Il timeout successivo viene programmato dal normale scheduler, con al massimo **un timeout OS attivo**. Non cambia la durata simulata di alcuna attesa, non introduce priorità nuove e non cambia le regole di occupazione delle celle.

La classe `NativeResidentTimerQueue` conserva entrambi i limiti configurabili; il default della classe resta senza limiti, per test di riferimento e confronti. **Solo il singleton usato su Android/iOS** applica 32 callback / 6 ms. Non sono stati modificati renderer Phaser/web, GameContext, salvataggi, logiche di gioco o servizi di produzione.

## Semantica e protezioni

- Il budget usa lo stesso orologio monotono `performance.now()` della coda. È campionato all'inizio del turno e dopo ogni callback completata, non nel mezzo della callback.
- **Limite soft, non hard**: una callback che impiega 12 ms non può essere interrotta dopo 6 ms; termina e poi il turno cede il controllo. Nessuna promessa di latenza massima dei tocchi.
- Il limite numerico di 32 rimane attivo anche se l'orologio restituisce valori non validi o regressivi. La misura non richiede polling.
- Una callback che fallisce non impedisce alle altre di essere eseguite nei turni successivi; il primo errore continua a essere propagato dopo la pulizia dello scheduler.
- Una callback può cancellare una sorella già estratta o ancora nel heap. I timer nuovi creati dentro un turno non vengono eseguiti in quel turno.
- Pausa, background, pausa/ripresa sincrona e unmount interrompono il lotto, preservando il lavoro residuo. La coda conserva il tempo **attivo** residuo, non recupera il tempo in background.
- L'ordine è `(dueActiveMs, id)`, quindi FIFO per scadenze uguali; la distribuzione in turni successivi può ritardare alcuni retry di collisione, senza cambiarne l'ordine logico.
- `budgetYields` conta i turni che hanno lasciato scadenze già mature. `timeBudgetYields` ne distingue il sottoinsieme causato dal limite temporale. Sono conteggi aggregati, senza ID, coordinate o dati di gioco.

## Test e modello sintetico

`tests/native-resident-timer-time-budget.test.ts` copre: 200 callback da 2 ms simulate, 10.000 timer con cancellazioni distribuite, una callback da 12 ms che fallisce, cancellazioni tra callback già estratte e ancora nel heap, pausa durante il batch, background prolungato, budget non validi, confronto con il limite solo numerico e integrazione con 200 `NativeResidentSegmentRunner`, RAF persistenti, pausa e velocità 1×/2×/4×.

`tests/native-resident-timer-time-budget-benchmark.ts` usa un **clock finto** che avanza di 2 ms per callback, non un busy wait e non un timer di sistema reale. A parità di 200 callback:
- limite solo numerico: 7 turni, massimo **32 callback / 64 ms simulati** per turno;
- limite numerico + 6 ms: 67 turni, massimo **3 callback / 6 ms simulati** per turno.

A parità di 10.000 callback:
- limite solo numerico: 313 turni, massimo 32 callback / 64 ms simulati;
- limite numerico + 6 ms: 3334 turni, massimo 3 callback / 6 ms simulati.

Sono **conteggi deterministici attesi dal modello**, non millisecondi di CPU misurati su dispositivo. I test automatici verificano queste invarianti; la CI non applica soglie di tempo assolute. Non è possibile dedurre da questi numeri un aumento di FPS, una latenza touch reale o un miglioramento energetico.

## Diagnostica e confronto prima di un merge

L'HUD nativo mostra il limite numerico, il limite temporale e il numero di yield temporali al secondo. Il report locale condivisibile di 10 secondi distingue `budgetYields` e `timeBudgetYields`. Le misure sono solo in memoria e si avviano esplicitamente; non vengono trasmesse automaticamente.

Confrontare sullo **stesso Android e sullo stesso iPhone**, nelle stesse condizioni, la #295 (baseline), #296 (RAF condiviso) e #297 (RAF, heap, batching e sprite). Scene da **25, 50, 100 e 200 abitanti**; 1×, 2×, 4×; 200 retry di collisione simultanei; pause manuali; background 30 s; tap e doppio tap; zoom/pan; camminata e tragitti casa-lavoro. Per ogni scena registrare almeno tre misure da 10 secondi e riportare **FPS JS e UI separati**, p95 e massimo dei batch timer/RAF, tempi percepiti di risposta ai tocchi e ritardo dei retry. La misura JS del HUD **non equivale** a FPS UI/GPU né misura la latenza touch.

**Rischio principale:** se i retry sono costosi, il budget di 6 ms distribuisce il carico su più turni e potrebbe ritardare visibilmente alcuni residenti. Se il compromesso non è buono su dispositivi reali, ripristinare il solo limite di 32 cambiando la costante temporale a `Infinity`, oppure rivalutare il budget con dati reali. La PR resta Draft e stacked su #296→#295; nessun merge o deploy automatico.
