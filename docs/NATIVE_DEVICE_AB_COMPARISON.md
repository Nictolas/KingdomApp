# MyKingdom — confronto riproducibile A/B su Android e iPhone

## Scopo

Per la scena con **sprite nativi reali**, questo protocollo confronta la **baseline di laboratorio #298** (stesso renderer della #296, **con la medesima fixture di #297**) e **la candidata #297** sullo stesso smartphone. I quattro file del laboratorio sono stati verificati byte-per-byte identici nei due rami. **#295** si può usare come baseline soltanto per la vecchia scena di **marker semplici**: non contiene il componente nativo dedicato che rende valida una prova con 200 veri sprite. Nessun benchmark Node sostituisce misure su dispositivo. Tutte queste PR restano Draft senza merge o deploy.

Sono già disponibili nell'interfaccia di sviluppo dell'app il pannello **«Misura 10 secondi»** e la funzione **«Condividi risultati»**. Il nuovo analizzatore offline legge direttamente quel testo. **Non** è necessario collegare un servizio, raccogliere identificativi, caricare dati su internet o installare un SDK esterno.

## Validità di una misura

La #297 interrompe esplicitamente la cattura (e chiude il profiler e il probe JS) se, durante i 10 secondi:

- cambia il numero di abitanti, il tipo di scena o il numero di celle della mappa;
- la simulazione passa da 1× a 2×/4×, viene messa in pausa o riprende (anche tra due frame);
- l'app viene sospesa o cambia stato foreground/background;
- l'utente esce dalla schermata nativa.

Il report della #297 registra **«Velocità simulazione: 0x/1x/2x/4x»**. Il valore 0x segnala simulazione in pausa/bloccata e può comparire nella schermata di marker sintetici. Le baseline #295 e #298 non includono quel campo: il comparatore lo segnala esplicitamente e richiede di verificare **manualmente** che la velocità dei due gruppi sia realmente uguale. Le misure con velocità diverse non sono aggregabili. I campi del report contengono solo dati diagnostici aggregati, non percorsi, cittadini o coordinate.

## Protocollo sullo stesso dispositivo

1. Usare **due build di sviluppo distinte**: **#298 contro #297** per la modalità `Sprite abitanti reali`, oppure **#295 contro #297** soltanto per `Marker semplici`. Non incrociare le due scene. Stessa versione di React Native e configurazione, scena e telefono fisico; non usare la build di produzione. Attendere dopo l'apertura della mappa.
2. Iniziare con **200 sprite reali sintetici**, velocità 1× e `Muovi`, poi 200 a 4× e 50 a 1×. Aggiungere successivamente 25/50/100/200 residenti a 1×/2×/4× e un caso `Fermi`. Verificare che la simulazione non sia a **0×** (pausa). Non confondere **«Marker animati»**, **«Sprite abitanti reali»** (stessi componenti nativi della mappa, ma senza IA) e la **«Mappa vera»** (partita completa).
3. Per ogni combinazione fare **almeno tre** misure indipendenti da 10 secondi su ciascuna build, in condizioni comparabili. Copiare tutti i report della baseline in un unico file `prima.txt`, quelli della candidata in `dopo.txt`. Ogni report inizia con la riga `MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)`; si possono separare con una riga vuota.
4. Se un report viene interrotto per una transizione, **scartarlo**. Non selezionare nel confronto rapporti con popolazione, piattaforma, scena, terreno, durata o velocità differenti. Ripetere il confronto per ogni scenario: non mescolare 25/50/100/200 abitanti nello stesso file.
5. Controllare visivamente sul dispositivo movimento, collisioni, tocco e doppio tocco, passaggio dei tocchi alla griglia, pausa/foreground/background, cambio percorso e regressioni degli sprite. Il tool di confronto **non** sostituisce queste prove.

## Matrice completa 25–200 abitanti, 1×/2×/4×

Per verificare **tutte le 12 combinazioni** senza selezionare soltanto lo scenario migliore, usare anche il validatore offline descritto in [`NATIVE_REAL_SPRITE_AB_MATRIX.md`](NATIVE_REAL_SPRITE_AB_MATRIX.md). Richiede 72 catture da 10 secondi, conferma manuale del medesimo dispositivo e controllo esplicito della velocità se la baseline #298 non la registra. La matrice può essere eseguita parzialmente solo con `--allow-partial`, e non autorizza automaticamente alcun merge.

## Confronto automatico offline

Dal repository `Nictolas/KingdomApp`, con Node 22 o superiore, eseguire:

```bash
node scripts/compare-native-js-reports.mjs --baseline prima.txt --candidate dopo.txt
```

Per un output JSON riutilizzabile:

```bash
node scripts/compare-native-js-reports.mjs --baseline prima.txt --candidate dopo.txt --json
```

Il tool è in sola lettura e non salva o invia dati: usa soltanto `fs.readFileSync` e stampa i risultati. Confronta le **mediane** dei due gruppi, il p95 del frame JavaScript, la media del frame, la quota di frame JS superiori a 50 ms e, **solo se presenti in entrambi i formati**, i p95 dei batch RAF/timer, il ritardo del loop JS e i gestori `Pressable`. Le metriche mancanti nella #295 **non diventano zero**.

Rifiuta report non validi o mescolati, e stampa avvisi su velocità non certificate, meno di tre prove, campioni insufficienti o forte variabilità tra ripetizioni. Una variazione peggiorativa maggiore di 15% e almeno 2 ms è indicata **«VERIFICARE possibile regressione»**, non dichiarata automaticamente come un fallimento statistico. Per la percentuale di frame sopra 50 ms viene usata una soglia assoluta in punti percentuali. Nessun esito positivo può certificare da solo una migliore fluidità fisica.

## Limiti dichiarati

- **FPS JS / RAF ≠ FPS dell'interfaccia grafica o della GPU.** Il profilo di un evento `Pressable` misura solo il lavoro JS **dopo** la consegna dell'evento, non la latenza fisica del dito sullo schermo.
- Le baseline #295 e #298 non contengono tutti i contatori della #297; il confronto seleziona soltanto le misure comuni. Anche l'overhead del pannello diagnostico è differente nelle due versioni: per FPS UI/GPU, consumo e GC servirà un profiler nativo esterno.
- Il comparatore non conosce l'identità dello smartphone, il livello di batteria, la temperatura, le impostazioni GPU/UI o la versione effettivamente installata. Sono controlli esterni da registrare manualmente per non trarre conclusioni errate.
- Evitare test con risparmio energetico attivo, app in background o dispositivo caldo. Affiancare, quando disponibile, una cattura UI/GPU e una traccia heap/GC con il profiler nativo.
- Il test automatico CLI e il gate TypeScript sono indipendenti dalla CI generale: **non** ne mascherano i fallimenti. Nessun merge di #297 in `main` fino a prove su dispositivi fisici e revisione dei risultati.
