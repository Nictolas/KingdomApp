# MyKingdom — matrice A/B verificabile degli sprite nativi

## Perimetro

Questo controllo **offline** completa il confronto dei report diagnostici JavaScript fra la **PR Draft #298** (renderer nativo prima della timer queue) e la **PR Draft #297** (renderer ottimizzato). Entrambe devono usare la **stessa scena con sprite reali**, non i marker semplici della #295. Non modifica il gioco, i salvataggi, la mappa web, la simulazione o la fixture A/B. Non usa servizi di telemetria né raccoglie ID, coordinate o dati degli abitanti.

La matrice prevista comprende **25/50/100/200 abitanti × velocità 1×/2×/4×**: 12 scenari, almeno tre catture da 10 secondi per ciascuna build e scenario, ossia **72 report** per una matrice completa. Per ogni scenario servono due file di testo contenenti tre report concatenati. Ripetere su Android e iPhone con manifest separati; non mescolare piattaforme.

## Procedura sul dispositivo

1. Installare due **build di sviluppo distinte** dei commit verificati di #298 e #297 sullo **stesso telefono fisico**. Non utilizzare Expo Go né il bundle JavaScript come se fosse una build installabile. Annotare localmente commit, modello, versione OS, stato batteria/temperatura e condizioni della prova. Il report diagnostico non certifica questi dati.
2. Aprire la scena `Sprite abitanti reali in movimento`, impostare la popolazione e la velocità, attendere che si stabilizzi. Non cambiare scena, velocità, pausa o stato foreground durante la cattura.
3. Usare `Misura 10 secondi` e `Condividi risultati` almeno tre volte per ogni build e scenario. Conservare i report completi in due file locali distinti. Le catture annullate non valgono.
4. Ripetere per i 12 scenari. Le prove `Sprite abitanti reali fermi` richiedono un **manifest distinto**, perché non possono essere mescolate con quelle in movimento.
5. Eseguire separatamente i test **visivi/fisici** di collisioni, ingressi condivisi, tap/doppio tap, hitbox, zoom/pan, pausa, background e cambio percorso. Misurare FPS UI/GPU, memoria/GC, batteria e latenza touch con strumenti nativi: **nessuno di questi dati viene dedotto dal tool JS**.

## Manifest locale

Creare un file `matrix-android.json` nella stessa cartella dei file di report. Esempio con **un solo scenario**:

```json
{
  "schemaVersion": 1,
  "platform": "android",
  "scene": "Sprite abitanti reali in movimento",
  "samePhysicalDeviceConfirmed": true,
  "scenarios": [
    {
      "residents": 200,
      "speed": 1,
      "baseline": "prima-200-1x.txt",
      "candidate": "dopo-200-1x.txt",
      "baselineSpeedConfirmed": true
    }
  ]
}
```

**Attenzione:** `samePhysicalDeviceConfirmed` è una dichiarazione manuale, non un controllo tecnico. Impostarla a `true` solo dopo aver realmente usato lo stesso telefono. La #298 storica può omettere `Velocità simulazione`: `baselineSpeedConfirmed: true` va aggiunto **solo dopo aver verificato manualmente** che tutte le catture baseline erano a 1× nell'esempio. Se anche la candidata non registra la velocità, usare `candidateSpeedConfirmed: true` con la stessa cautela. Il tool non può verificarlo da solo.

Per una matrice completa, aggiungere gli altri undici oggetti `scenarios` con tutte le combinazioni di `residents: 25, 50, 100, 200` e `speed: 1, 2, 4`, ciascuno con due file univoci. La scena e la piattaforma devono essere identiche per tutti.

## Comandi

Da Node 22+ nella radice del repository:

```bash
# Primo controllo parziale, esplicitamente non conclusivo:
node scripts/compare-native-ab-matrix.mjs --manifest matrix-android.json --allow-partial

# Quando sono presenti tutti i 12 scenari:
node scripts/compare-native-ab-matrix.mjs --manifest matrix-android.json --json
```

Senza `--allow-partial`, il comando **rifiuta** una matrice incompleta. Rifiuta anche popolazione, scena, piattaforma, dimensione terreno, durata, velocità o numero di catture incoerenti; report riutilizzati, meno di tre catture per build, meno di 100 campioni JS in una cattura e attestazioni manuali mancanti. Il campo `reviewMetrics` segnala regressioni JS potenziali: **non è un verdetto statistico o una certificazione FPS**. Il risultato finale è sempre `no_automatic_performance_or_release_approval`.

I file rimangono locali; il comando legge soltanto i report e stampa risultati. Non caricare i report in produzione né associare nomi o dati personali agli abitanti. Le build non devono essere fuse né pubblicate prima delle prove fisiche e della revisione dei risultati.

## Test automatici

`node --test tests/native-ab-matrix.test.mjs` esercita la matrice completa con **72 report sintetici**, scenari parziali, metadati discordanti, velocità baseline non registrata, duplicati, numero insufficiente di campioni e CLI reale su file temporanei. È integrato nella pipeline `native-perf-diagnostics.yml`. Questi test dimostrano la correttezza dei controlli del **tool**, non un miglioramento delle prestazioni su Android/iOS.
