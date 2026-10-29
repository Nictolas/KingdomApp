# MyKingdom — protocollo A/B reale su Android e iPhone (29 ottobre 2026)

## Perimetro e limiti
- **#298** è il controllo A/B con renderer `MapWandererCharacter` reale e motore della #296.
- **#297** è il candidato ottimizzato (timer queue, lifecycle e fault recovery).
- **#295** usa marker semplici, quindi NON è il controllo del renderer reale. **#294** è Phaser web e non è un confronto di FPS nativi.
- La schermata `/native-perf` è solo `__DEV__` e non simula l'intero regno: niente IA completa, edifici, professioni, salvataggi o traffico di rete. La modalità “Tragitto ripetibile” evita intenzionalmente collisioni; la modalità casuale può esercitare prenotazione/occupancy.
- Il report di 10 s contiene **cadenza RAF JS e costo dei callback JS**, non FPS GPU/UI, latenza touch fisica o consumo batteria. Per queste ultime misure usare i profiler del sistema operativo.
- Non includere informazioni personali o salvataggi nei report. Non caricare automaticamente nulla.

## Preparazione manuale indispensabile
1. Compilare **due build di sviluppo installabili**, una dal commit di #298 e una da #297, **senza** fare merge, deploy o rilascio pubblico. I workflow Expo `export` producono bundle JS, NON APK/IPA.
2. Usare lo **stesso dispositivo fisico**, versione OS, impostazioni di sviluppo, orientamento, luminosità, stato di carica, temperatura approssimativa e condizioni di rete per ciascuna coppia. Ripetere su almeno un Android e un iPhone. Disabilitare il debug remoto JS e evitare il throttling del simulatore.
3. Aprire `/native-perf`, selezionare “Sprite abitanti reali”, “Tragitto ripetibile” e una densità (25, 50, 100, 200). La fixture deve avere 400 celle. Selezionare velocità 1×/2×/4× tramite i controlli normali del gioco **prima** di avviare la cattura.
4. Attendere la conferma che tutti gli sprite abbiano occupato una cella e completato almeno un tragitto, poi altri 2 s di stabilizzazione. Espandere “Diagnostica JS · Dettagli”, eseguire “Misura 10 secondi”, condividere il report manualmente. Non cambiare scena, velocità, pausa o app foreground durante i 10 s: il sistema invalida la misura.
5. Eseguire almeno **tre catture** valide per ogni combinazione densità × velocità, alternando i rami A/B per limitare gli effetti di riscaldamento e ordine. Non confrontare Android contro iPhone, 25 contro 200, oppure movimento casuale contro tragitto ripetibile.
6. Ripetere un ciclo distinto con movimento casuale, collisioni, tap/doppio tap, pause/riprese e background/foreground. Questi eventi invalidano la cattura continua di 10 s: annotarli come test funzionali separati.
7. Registrare con strumenti OS (Android Studio Profiler/Perfetto; Instruments/Core Animation su iOS) frame UI/GPU, latenza touch e CPU, se disponibili. Annotare esattamente strumento e dispositivo: non ricavare tali numeri dai report JS.

## Controlli automatici per confrontare i report
`parseNativeRealSpriteABReport` e `compareNativeRealSpriteABReports` in `src/performance/nativeRealSpriteABComparison.ts` validano le stringhe **già condivise dall'operatore**, senza storage o rete. Richiedono:
- intestazione diagnostica JS esatta, piattaforma Android/iOS, scena sprite reali, densità 25/50/100/200, velocità 1×/2×/4×, 400 celle, 10 secondi;
- campioni JS sufficienti, campi obbligatori presenti una sola volta, contatori coerenti e valori numerici finiti;
- **stessa piattaforma, scena, densità, velocità e durata** per la coppia A/B.

Restituiscono differenze di FPS **JS**, p95 frame **JS**, p95 lag event loop e numero callback timer. **Non** calcolano né dichiarano miglioramenti FPS UI/GPU o latenza fisica. Il confronto non è integrato nella schermata di gioco e non trasmette nulla. Le prove unit test coprono 24 combinazioni piattaforma/densità/velocità e casi non confrontabili.

## Stato verificabile
- Suite Node della #297 e controlli di regressione separati dalla CI generale.
- La CI generale ha 53 errori TypeScript storici; verificare che non aumentino e che il gate di regressione rimanga verde.
- Bundle Android/iOS/web sono **smoke test JS**, non build installabili.
- **Nessun dato di performance fisica** finché le prove manuali non saranno eseguite e raccolte.

Nessun merge, deploy, release o modifica a GameContext, salvataggi, regole di gioco o renderer web.

## Confronto robusto di almeno tre catture

Il modulo puro `src/performance/nativeRealSpriteABReplicates.ts` accetta **da 3 a 30 coppie** di report A/B già acquisiti manualmente. Ogni coppia deve essere #298 → #297 con stessa piattaforma, scena, popolazione, velocità e durata; anche tutte le ripetizioni devono appartenere alla stessa configurazione. Calcola la **mediana delle differenze per coppia**, il minimo/massimo delle differenze e il numero di coppie con FPS JS più alti o p95 frame JS più bassi. Una singola cattura eccezionale non può trascinare la mediana come una media aritmetica.

L'aggregazione non conosce modello fisico, temperatura, frequenza CPU o identità del dispositivo: **queste condizioni vanno verificate e annotate manualmente**. Non produce significatività statistica, causalità, FPS UI/GPU o una dichiarazione automatica di miglioramento. Se le ripetizioni mostrano risultati contrastanti, aumentare il campione e analizzare con i profiler di sistema prima di concludere.

Il test `tests/native-real-sprite-ab-replicates.test.ts` copre outlier, numerosità dispari/pari, regressioni, 24 configurazioni e rifiuto di dati non confrontabili. È incluso nella CI diagnostica nativa.
