# MyKingdom — RAF native persistente: zero callback per segmento (29/10/2026)

## Perimetro e motivazione

La PR Draft **#297** già registrava i 200 residenti una sola volta sul `NativeResidentFrameBus` e riutilizzava la sottoscrizione lungo le catene sincrone `onArrival → start`. Tuttavia `NativeResidentSegmentRunner.start` costruiva ancora **una nuova funzione `step` per ogni segmento**, benché il dispatcher RAF persistente non avesse bisogno di quella nuova funzione. Inoltre allocava un array temporaneo di sei valori per ogni validazione del segmento e ricalcolava i delta fra coordinate di partenza/arrivo a ogni fotogramma.

La modifica è limitata al runner **native-only** e al suo percorso persistente. Non cambia le regole di movimento, il costo simulativo di un passo, le velocità 1×/2×/4×, i controlli collisione, prenotazioni delle celle, callback del gameplay, il `GameContext`, la serializzazione, il renderer web o i pacchetti di produzione.

## Implementazione end-to-end

1. **Dispatcher persistente per residente**. Ogni `NativeResidentSegmentRunner` possiede un'unica funzione `dispatchPersistentFrame` per tutto il proprio ciclo di vita. Il segmento in corso è conservato in `currentPersistentRequest`, non in una nuova closure `step`; quando arriva un RAF, il dispatcher richiama `runFrame` passando il token di generazione e la richiesta corrente.
2. **Compatibilità one-shot**. Il vecchio ramo `requestFrame`, usato come riferimento nei test, mantiene le proprie callback token-bound per respingere eventi nativi obsoleti. Le due modalità condividono la stessa implementazione di progressione in `runFrame`, per evitare drift delle regole.
3. **Coefficienti di movimento**. `fromX`, `fromY`, `deltaX` e `deltaY` vengono calcolati quando si avvia il segmento, invece di ripercorrere l'oggetto richiesta e ripetere due sottrazioni ogni RAF.
4. **Validazione priva di array**. I sei numeri di partenza/destinazione/durata/timestamp vengono controllati con verifiche esplicite, senza `[...].every(...)`. Valori non finiti e durate non positive vengono ancora rifiutati prima di cancellare un tratto valido.
5. **Reentrancy e cleanup**. Dopo ogni callback utente o mutazione di `Animated.Value`, rimane il controllo di generazione. Un nuovo tragitto avviato durante `onArrival` non avanza nello stesso RAF; stop, pausa, cambio scena, ritardi nativi e callback lanciate dopo una cancellazione non riattivano il tragitto precedente.
6. **Contatori non personali**. Lo snapshot del runner espone `segmentStarts` e `frameCallbackAllocations` per prove strutturali. Questi numeri sono generati in memoria, non contengono ID o coordinate e non vengono inviati o salvati.

## Evidenze verificabili automaticamente

La suite `tests/native-resident-allocation-stable-segments.test.ts` controlla:

- **200 residenti × 20 tratti = 4.000 segmenti**, velocità 1×/2×/4×, pausa e background, nessun teletrasporto, zero callback RAF create per segmento persistente e un massimo di un RAF di piattaforma;
- **200 residenti × 8 tratti**, confronto fotogramma per fotogramma contro il runner one-shot (coordinate, arrivi e stato walking), inclusa semantica pausa/ripresa;
- **200 cambi di percorso durante le scritture Animated.Value**, nessun arrivo del tragitto obsoleto;
- errore `onArrival` per un residente, senza bloccare i 199 validi né mantenere RAF fantasma;
- 50 dismount e mount durante pausa, rimozione delle vecchie sottoscrizioni e ripresa corretta;
- controllo statico per impedire regressioni della validazione tramite array e delle closure step persistenti.

Il benchmark `tests/native-resident-segment-dispatch-benchmark.ts` confronta i due percorsi a **200 residenti × 20 segmenti** e **1.000 residenti × 8 segmenti**, a velocità 1×/2×/4×.

### Riduzione strutturale attesa

| Carico sintetico | Callback per segmento nel precedente runner | Nel nuovo persistente |
| --- | ---: | ---: |
| 200 residenti × 20 segmenti | 4.000 | 0 |
| 1.000 residenti × 8 segmenti | 8.000 | 0 |

I numeri indicano **solo le closure `step` per segmento** e non includono le callback di arrivo definite dalla logica di gioco, i callback del dispatcher creati una volta per residente, le allocazioni React o i costi di rendering. Il numero di callback **eseguite per frame non cambia** e non si ricavano da questi conteggi CPU, frame rate, autonomia o latenza touch.

Il benchmark misura durate **Node su runner CI condiviso**, senza soglie millisecondi assolute. I risultati non equivalgono a misurazioni Hermes o UI/GPU su Android/iOS.

## Regressioni e integrazione

- La pipeline dedicata esegue la nuova suite, il benchmark e i gate esistenti di progressione, collisioni, pause, tocchi, RAF e timer; produce tre bundle Expo JS (non APK/IPA).
- Il Typecheck generale conserva una baseline di 53 errori legacy: nessun nuovo errore del runner può superare il gate dedicato.
- L'equivalenza A/B della fixture per sprite reali deve continuare a risultare SHA-identica per i quattro file condivisi tra #297 e #298.
- **Un test su dispositivi fisici resta indispensabile**, usando #298 (baseline sprite reali) contro #297 (versione ottimizzata), stesso Android/iPhone per ogni coppia, 25/50/100/200 sprite e 1×/2×/4×. La diagnostica in-app misura soltanto cadenza RAF JS, non gli FPS UI/GPU.

**Reversibilità:** commit esclusivamente nella PR Draft #297; nessun merge in main, deploy, release, modifica dei salvataggi o della versione web.
