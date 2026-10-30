# MyKingdom — riuso del clock per segmento nativo (29 ottobre 2026)

## Modifica coerente nel solo motore nativo della PR Draft #297

Ogni residente prima costruiva un nuovo `NativeResidentSegmentProgress` e un `PauseAwareMotionClock` a **ogni singolo passo**. A 200 abitanti e velocità 4× questo genera oggetti temporanei ripetuti, anche se il resident runner e il suo buffer RAF restano montati. Ora ogni `NativeResidentSegmentRunner` possiede **un solo** `NativeResidentSegmentProgress`, reimpostato a ogni nuovo passo/route replacement. Il clock nativo conserva soltanto timestamp, tempo simulato, durata e avanzamento come primitive. Nessun clock condiviso o GameContext è stato cambiato.

Il reset è validato prima della mutazione. Rimangono invariati: delta monotono, esclusione dei gap RAF ≥2 s, scale 0×/1×/2×/4×, rebase sul primo RAF dopo background, sprite, posizione, callback di arrivo, token anti-callback obsolete, occupazione delle celle e priorità dei percorsi. La vecchia API `sample()` restituisce ancora snapshot indipendenti; `sampleInto()` usa il buffer del chiamante senza allocazioni per frame. Il renderer Phaser web e la baseline A/B #298 non sono modificati.

## Prove e interpretazione

- `tests/native-resident-reusable-progress.test.ts`: confronto differenziale con il **clock canonico** `PauseAwareMotionClock` per 200 residenti × 64 reset × 14 campioni, inclusi timestamp regressivi, NaN, pausa, background e velocità. Verifica 200 runner reali con 12.800 sostituzioni e cleanup RAF, più 3.200 arrivi consecutivi a 4×.
- `tests/native-resident-progress-reuse-benchmark.ts`: modello Node sintetico 200 residenti × 600 segmenti. Confronta checksum e numero **logico di costruzioni di clock**, non memoria effettiva, GC, frame time, batteria o FPS.
- Il workflow dedicato include test e benchmark oltre ai bundle JS Android/iOS/web. La CI generale resta separata e non viene mascherata.

**Rischio residuo:** la copia nativa della semplice logica del clock può divergere se in futuro cambia `PauseAwareMotionClock`. Per questo il test differenziale deve restare nel gate CI; qualunque modifica futura alle regole di tempo richiede revisione esplicita. I risultati del benchmark Node non provano alcun miglioramento hardware. Prima di merge/rilascio servono A/B **#298 contro #297** su Android e iPhone fisici, inclusi 200 sprite, pause, collisioni, tap, 1×/2×/4× e profiler UI/GPU. Stima invariata: **80% della sola fase di ottimizzazione nativa**, non dell'intero gioco.
