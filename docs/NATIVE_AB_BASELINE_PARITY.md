# MyKingdom — baseline di confronto degli sprite nativi (PR #296, non #297)

## Perché esiste questo ramo

La PR **#295** crea un punto di riferimento per i marker React Native, ma **non contiene ancora** il componente `MapWandererCharacter.native.tsx`. Il renderer nativo dedicato è presente nella **#296**. Perciò non è tecnicamente corretto descrivere un confronto della **nuova scena con sprite reali** tra #295 e #297: la stessa scena non può girare su #295.

Questo ramo parte **esattamente dal commit #296** `3b8d62c0296651a492c8131bcdbd22bc7a83d40c` e aggiunge **solo la schermata diagnostica e i dati di test** riprodotti dalla #297. **Non copia** nessuna ottimizzazione del movimento, scheduler, cache degli eventi, buffer timer o gestione dei tocchi della #297. Conserva così il motore precedente alle ottimizzazioni aggiuntive.

La nuova modalità è limitata a **`__DEV__`**, non modifica main e non salva o manipola la partita.

## Stessi quattro file di prova, codici identici

I contenuti dei seguenti file sono intenzionalmente identici nei due rami:

- `app/native-perf.tsx` — stessa schermata e stesse modalità Marker semplici / Sprite abitanti reali.
- `src/performance/NativeRealResidentWorkload.tsx` — stesso montaggio di 25/50/100/200 componenti veri.
- `src/performance/nativeRealResidentFixture.ts` — stessa distribuzione di 200 abitanti su 400 celle e stessa occupazione locale.
- `tests/native-real-resident-fixture.test.ts` — stessi controlli di isolamento, 4000 collisioni e di correttezza dei dati.

Le differenze nel comportamento vengono dal componente nativo sottostante (#296 rispetto a #297), non dal generatore di residenti. Entrambe le build contengono la stessa fixture ma **non sono prove di una partita completa**: non includono IA, edifici, commercio, pathfinding generale e salvataggi reali.

## Guida alle misure

1. Preparare una build di sviluppo del ramo **`perf/native-real-sprite-ab-baseline-20261028`** (baseline motore #296) e una build della PR #297 (`perf/native-resident-timer-batching-20261028`). **Non** utilizzare la release normale né la PR #295 come baseline per la scena con sprite.
2. Sullo stesso Android e iPhone, entrare nel gioco e accertarsi che la simulazione sia attiva (**tempo diverso da 0×**). Entrare in `/native-perf` dalla mappa.
3. Selezionare `Sprite abitanti reali`; ripetere 25, 50, 100, 200 residenti, prima **Fermi**, poi **Muovi**, e 1×/2×/4×. Usare la stessa scena, lo stesso stato dei controlli, medesima versione di React Native/Expo e almeno tre repliche.
4. Profilare i **frame JS** con il pannello in modalità equivalente sui due rami. **Nota importante:** la #297 introduce anche diagnostica JS aggiuntiva e un HUD opt-in: aprire lo stesso pannello in entrambi i rami non garantisce overhead esattamente identico. Per un confronto più affidabile dei frame **UI/GPU, memoria e GC**, affiancare un profiler nativo esterno. Non attribuire benefici sulla sola base dei risultati JS interni.
5. Controllare visivamente collisioni, movimenti, tocchi, pause, background/foreground e ritorno alla mappa. Per valutare l'intera partita bisogna testare **la mappa reale**, non soltanto questa fixture.

I tre bundle JS Android/iOS/web della pipeline sono smoke test, **non APK/IPA installabili**; una compilazione verde non prova ancora la fluidità su dispositivo. Nessun merge/deploy/rilascio eseguito da questo ramo.

## Ruolo dei confronti

- **#295 → #297, soli marker sintetici:** disponibile (stessa schermata originale), ma poco rappresentativo del vero motore.
- **#296+fixture → #297, sprite nativi veri:** confronto pertinente per le ottimizzazioni aggiuntive della #297, con fixture identica e renderer diverso.
- **#296+fixture / #297, gameplay intero:** non completamente riprodotto da fixture; da verificare sulla vera mappa.
