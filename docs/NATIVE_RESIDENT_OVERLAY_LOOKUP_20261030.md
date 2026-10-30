# MyKingdom — lookup a costo costante nella mappa nativa (~200 abitanti)

## Perimetro (PR Draft #297, 30/10/2026)

La schermata **vera** `app/mappa.tsx`, durante un render causato dal
tempo di gioco o da un aggiornamento non correlato ai dati dei personaggi,
itera `abitantiPerOverlayMappa`. Per ogni sprite nativo visibile erano
eseguite ripetutamente:

- **Due** ricerche `abitanti.find(a => a.id === abitante.id)?.nome`
  per le etichette di accessibilità (tap/doppio tap), lineari nel numero
  totale di abitanti, anche se `abitanti` non è cambiato.
- La scansione `Object.values(barArrivatiByEdificio).some(ids =>
  ids.includes(abitante.id))` per determinare se nascondere il residente
  nel bar. Può attraversare i diversi edifici e gli arrivi **per ciascun**
  residente in quel render, anche se gli arrivi al bar non sono cambiati.

Con ~200 abitanti, queste scansioni possono ripetere un lavoro che cresce
quadraticamente con la popolazione nel caso sfavorevole. Si tratta di una
**osservazione strutturale del codice**, non di un profilo CPU su telefono.

## Implementazione native-only

`src/performance/nativeResidentOverlayLookup.ts` costruisce un piccolo
`Map<id,nome>` e `Set<id>` di arrivi al bar. Il hook
`useMemo(..., [abitanti, barArrivatiByEdificio])` in `app/mappa.tsx`
rigenera questi indici **solo** quando cambia l'identità di uno dei
due dati di ingresso; non dipende da minuti, velocità, pause, transform
o posizione dei residenti.

- `nameFor(id)` restituisce lo **stesso primo match** di `Array.find`
  e lo stesso fallback `ID ${id}` per un nome mancante. Un nome vuoto
  resta vuoto, senza normalizzazione.
- `hasBarArrival(id)` usa `Set.has` con la stessa semantica
  SameValueZero di `Array.includes` (anche con duplicati fra bar).
- Gli indici conservano soltanto primitivi (ID e nomi), non riferimenti
  ai componenti, agli oggetti del regno, ai salvataggi o alle callback.
- L'effetto **non modifica** la regola che decide quando l'abitante è al
  bar, al lavoro, al culto o in casa; accelera solo la consultazione dei
  nomi e degli arrivi nella porzione di rendering degli sprite.
- `Platform.OS === "web"` restituisce `null` e usa deliberatamente
  le espressioni legacy. **Nota trasparente:** essendo `app/mappa.tsx`
  un file condiviso, è stata modificata la sua sorgente e importato un
  helper puro; il ramo di esecuzione web resta quello precedente. Il
  bundle JS web richiede pertanto uno smoke test dedicato, non si assume
  byte-identità della build.

Non cambiano `GameContext`, salvataggi, database, versioni pubblicate,
Phaser, regole di gioco, routing, occupazione, tempi, animazioni, 1×/2×/4×,
touch target o collisioni. Nessun impatto previsto sul percorso
`abitanteVisibileSuMappaPhaser`, che usa la scansione originale.

## Test introdotti

`tests/native-resident-overlay-lookup.test.ts` confronta, senza React
Native, la selezione con l'implementazione precedente:

1. Matrice 25/50/100/200 abitanti, 100 ripetizioni per densità.
2. Fino a 12 bar e duplicati negli arrivi; 80 iterazioni per densità.
3. Primo match con ID duplicati, nomi vuoti, mancanti o nulli.
4. Semantica SameValueZero (NaN, +0/-0) nelle presenze.
5. Snapshot non mutabile automaticamente e nuova snapshot su nuovi dati.
6. **200 abitanti × 500 tick** e 19 aggiornamenti immutabili simulati.
7. Verifica del codice sorgente: hook soltanto nativo, percorso legacy web
   conservato, vecchia logica di visibilità Phaser non sostituita.

`tests/native-resident-overlay-lookup-benchmark.ts` confronta in Node
i due percorsi per 25/50/100/200 abitanti × 500 render simulati,
con verifica di **checksum identici** e dei conteggi di selezione.
Stampa tempi **Node** esplorativi, senza soglie arbitrarie di velocità:
né `console.log` né questi tempi possono essere interpretati come
risultati su React Native, FPS, CPU/GPU hardware, batteria o fluidità.

La CI diagnostica nativa include test e benchmark nelle suite 08/16.
Le build JavaScript Android/iOS/web vanno confermate sul commit più
recente; gli export non generano automaticamente APK/IPA installabili.

## Verifica ancora indispensabile

Su Android/iPhone **fisici**, con le stesse scene e almeno tre catture
A/B per configurazione, misurare 25/50/100/200 sprite e velocità
1×/2×/4×, oltre a scene reali con molti arrivi al bar, ripetuti tick
del mondo, tocchi, collisioni, pause e foreground. Controllare frame
UI/GPU con strumenti OS e distinguere costo JS, React commit e GPU.
Il miglioramento teorico non è una dichiarazione di FPS misurati.

La baseline A/B resta la Draft #298 (stessi quattro file della fixture),
non la marker #295; #296 resta base delle ottimizzazioni native e #294
riguarda Phaser web. Non effettuare merge o rilascio senza validazione.
La stima complessiva di questa **sola fase nativa** resta 80% finché
non saranno disponibili prove sui dispositivi.
