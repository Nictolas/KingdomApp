# MyKingdom — pannello diagnostico a costo RAF zero quando è chiuso

## Problema risolto

Nella PR Draft #297, prima dell'intervento, `NativePerformanceHud` veniva montato sulla mappa reale **anche quando il pannello era chiuso**. Il suo `useFocusEffect` programmava ricorsivamente `requestAnimationFrame(onFrame)` e pubblicava aggiornamenti React dei contatori circa ogni secondo. Questo lavoro di misura poteva interferire con il carico dei ~200 residenti anche se il giocatore **non aveva richiesto alcuna diagnostica**.

L'intervento è limitato al pannello di sviluppo (l'overlay è disponibile solo in `__DEV__`). Non modifica la simulazione, le collisioni, il motore Phaser web, gli shader, il consumo della GPU, le regole di gioco, gli abitanti, `GameContext` o i salvataggi.

## Nuovo ciclo di vita

- Quando il pannello è **chiuso**, `useFocusEffect` **non** avvia un RAF diagnostico, non installa listener dell'orologio, non esegue polling dei timer/sprite e non pubblica aggiornamenti dei contatori.
- Quando si preme **Dettagli**, avvia la diagnostica locale di sola lettura e programma **un unico** `requestAnimationFrame` in primo piano. Resta possibile premere **Misura 10 secondi**, raccogliere contatori aggregati e condividere il report come prima.
- Quando si preme **Chiudi**, si cambia schermata o l'app va in background, `NativeHudFrameLoop` cancella la RAF pendente e termina il polling. La diagnostica non chiama più `requestAnimationFrame` mentre l'app non è attiva.
- In caso di callback native ricevute **dopo** la cancellazione, un contatore di generazione impedisce di eseguire le vecchie callback e di registrare una RAF fantasma. Una riapertura crea un ciclo di misura distinto.
- Il pannello chiuso mostra **«Diagnostica JS · Dettagli»** anziché vecchi FPS che potrebbero essere interpretati come dati attuali. La misura di 10 secondi rimane avviata *solo* su richiesta esplicita e non invia dati.

## Verifiche automatiche

`tests/native-hud-frame-loop.test.ts` controlla:

1. **10.000 frame simulati** con pannello chiuso e **zero** richieste RAF diagnostiche.
2. **600 frame con pannello aperto**, con massimo un RAF pendente.
3. Background/foreground e **500 notifiche duplicate** di background, senza raffiche di recupero.
4. **200 aperture/chiusure** senza perdite di RAF o risveglio di callback già annullate.
5. Avvio in background, chiusure ripetute e rientri, callback obsoleti dopo riapertura.
6. Chiusura/riapertura **sincrone all'interno di un frame**, senza duplicare RAF.
7. Contratto della componente React Native: il loop viene creato solo con pannello aperto, cancellato su blur e background, ed è collegato al listener `AppState`.

Il test è aggiunto al workflow `.github/workflows/native-perf-diagnostics.yml`. Le prove sono **solo Node con callback RAF simulate**; non sostituiscono un test visivo su Android/iPhone. Il risparmio strutturale verificato è un callback RAF diagnostico per frame eliminato quando il pannello è chiuso: non è una misurazione di FPS o consumo di batteria.

## Come misurare il beneficio

Su una build di sviluppo, aprire la mappa con 200 residenti e lasciare l'overlay **chiuso** per il caso di gioco normale. Poi aprire il pannello per leggere i contatori e misurare 10 s, sapendo che il monitoraggio introduce un carico minimo mentre è aperto. Confrontare baseline #295 e candidata #297 **con lo stesso stato dell'overlay** e sul medesimo smartphone; distinguere i casi a pannello chiuso da quelli a pannello aperto, senza confonderli.

La percentuale precedente, **78%**, continua a rappresentare una stima della sola fase di ottimizzazione nativa, non di tutto MyKingdom. Il prossimo passaggio per incrementarla in modo difendibile è ottenere CI completa e misure hardware A/B ripetute. Nessun merge/deploy/rilascio.


## Precisione del campionamento e intervalli a cavallo dell'avvio

Il pulsante «Misura 10 secondi» può essere premuto mentre è già in corso un intervallo di animazione RAF. Una misura corretta deve iniziare **dal momento in cui si preme il pulsante**, non dall'ultimo RAF programmato prima del tap. `NativeMeasurementSession` ora scarta il primo delta RAF se `timestamp - delta` precede l'avvio della cattura; tutti gli intervalli interamente contenuti nella finestra restano rilevati. I campioni il cui timestamp è oltre la scadenza non vengono inclusi.

Una lunga sospensione JavaScript (almeno 2.000 ms) **avvenuta prima** della cattura non la rende falsamente invalida; una sospensione di pari durata **durante** la cattura ne provoca invece l'annullamento esplicito, con nuovo avviso nel pannello. I test `tests/native-capture-integrity.test.ts` e `tests/native-performance-diagnostics.test.ts` verificano questi casi. Questo migliora la comparabilità delle statistiche JS senza pretendere di misurare i frame della GPU.
