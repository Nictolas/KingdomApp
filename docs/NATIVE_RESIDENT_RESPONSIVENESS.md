# MyKingdom — Diagnostica della reattività nativa (28/10/2026)

## Ambito e isolamento

Intervento sperimentale nella PR Draft **#297** (stacked su #296 → #295), **solo percorso Android/iOS**. Non modifica Phaser web, GameContext, percorsi, salvataggi, regole di gioco, collisioni o velocità. Nessun merge o deploy. Tutti i dati rimangono in memoria: nessuna telemetria, storage, identificatore dell'abitante, coordinate o contenuto dei tocchi.

La diagnostica viene avviata **solo premendo «Misura 10 secondi»** nel pannello nativo. A riposo il probe non programma timer e il profiler non legge il clock per i callback non campionati.

## Quattro segnali complementari

1. **Frame JS / RAF**: il frame pacing del JavaScript e il tempo di esecuzione del batch condiviso dei 200 residenti. Non misura FPS della UI thread o GPU.
2. **Batch timer**: durata delle operazioni di collisione/idle eseguite per wakeup, utile per verificare il budget cooperativo di 6 ms (soft, non preemptive).
3. **Gestore tocchi JS**: tempo trascorso **dall'ingresso nel callback Pressable fino all'uscita**. Include l'esecuzione del callback di selezione o doppio tap. Non include attesa sulla coda eventi prima dell'ingresso né il rendering successivo.
4. **Ritardo del loop JS**: un unico heartbeat `setTimeout` ogni 50 ms durante la cattura. La differenza tra scadenza richiesta ed esecuzione osservata è una misura approssimativa della congestione del thread JavaScript, **non** la latenza di un tocco fisico.

In aggiunta, la misura comprende il **costo JS dei listener di pausa/background** (`NativeResidentFrameBus.setActive`), così si può distinguere una transizione lenta da un frame lento. Sono riportati campioni, media, p95 e massimo, oltre alle soglie applicabili.

## Protezioni di correttezza e risorse

- Un solo timeout del probe è attivo; il successivo viene programmato **dopo** l'esecuzione del precedente. Dopo un blocco JS non c'è una tempesta di callback arretrati.
- Il buffer circolare contiene al massimo **256 campioni** del ritardo; il report mostra anche quanti sono stati sovrascritti. Gli altri quattro profili hanno capienza indipendente di 4.096 campioni per categoria.
- I token di cattura impediscono a callback tardive (dopo `clearTimeout`) di contaminare una misura successiva.
- L'uscita dalla schermata, il background e l'avvio di una nuova misura cancellano **entrambi** i sistemi di profiling. Nessun polling permanente.
- I callback di tap e dei listener continuano a propagare le eccezioni; la misurazione termina in `finally`, senza alterare la semantica di gioco.
- Le operazioni di monitoraggio hanno un costo: confrontare solo misure effettuate con **lo stesso pannello attivo e la stessa configurazione**. Un singolo heartbeat da 50 ms non è un benchmark di latenza fisica.

## Test sintetici automatici

`tests/native-resident-responsiveness.test.ts` verifica con clock e scheduler fittizi:
- correttezza del ritardo JS (0, 8, 36, 66 ms) e p95;
- **10.000 heartbeat** senza accumulo di timer, buffer limitato a 64 campioni e nessuna raffica di recupero;
- cancellazione, riavvio e consegna tardiva di un timeout cancellato;
- regressione del clock e clock non valido;
- **200 gestori di tap** e 40 transizioni pausa/ripresa con 200 listener;
- contenuto del report condivisibile senza dati individuali.

La CI esegue i test con Node/tsx e le tre compilazioni JavaScript Android, iOS e web come smoke test. **Nessuno di questi risultati costituisce una misura su dispositivo**.

## Procedura manuale indispensabile per attribuire un miglioramento reale

1. Preparare una build Android e una iOS di **#295 baseline** e una build sperimentale di **#297**, con identica configurazione e stesso dispositivo; non sovrascrivere la build di produzione.
2. Aprire la scena reale con 25, 50, 100 e 200 abitanti. Misurare 10 s dopo il caricamento, poi 10 s con movimento e collisioni. Ripetere almeno 3 volte per scenario.
3. Ripetere a 1×, 2× e 4×, e durante un ciclo pausa/ripresa. Annotare frame JS p95, batch RAF/timer p95, ritardo del loop JS p95 e conteggio dei render React.
4. Durante un'altra misura, selezionare diversi abitanti e provare il doppio tap; annotare il tempo del gestore JS. **Per la latenza touch end-to-end** usare separatamente uno strumento di profiling nativo o una registrazione ad alta frequenza con marcatura dell'evento hardware e del frame UI. Il report interno non la misura.
5. Verificare visivamente che non vi siano teletrasporti, collisioni duplicate, tocchi persi o alterazioni del ritmo di gioco. Non dichiarare aumento di FPS o minore latenza finché non esistono risultati fisici riproducibili.

## Rischi residui

Il probe da 50 ms aggiunge un leggero carico JS **soltanto durante la cattura**. Il tempo del callback `Pressable` non indica quanto ha atteso un evento nella coda nativa. La pausa può interrompere la misura, quindi non usarne il report per confrontare una sessione incompleta. La CI generale può continuare a fallire per errori TypeScript storici non collegati.

## Verifica CI del commit 36798393 (28/10/2026)

- Workflow **Native Performance Diagnostics Tests** `40671082808`: completato con esito `success`.
- Workflow generale **CI** `40671082814`, job `Verify` `122757738230`: completato con esito `failure`, `tsc` exit code 2.
- Il log TypeScript segnala, fra gli altri, importazioni inesistenti (`generaColoniaIniziale`, `SPAZIOPORTO_FOOTPRINT_H/W`), fixture `Edificio` incomplete, campi `Abitante` non conformi e parametri implicitamente `any` nei test di altri sistemi.
- Non attribuire automaticamente tutti gli errori a codice legacy senza un confronto dei log con il commit della baseline. Non nascondere o escludere test dalla CI generale per ottenere un verde artificiale.
- Nessuna misurazione hardware Android/iOS è stata eseguita. Le verifiche bundle e i test Node non provano FPS, UI thread o latenza touch fisica.

**Gate prima del merge:** confrontare diagnostica TypeScript su #295, #296 e #297, verificare l'assenza di regressioni native, poi completare la matrice manuale su dispositivi. La #297 resta Draft.
