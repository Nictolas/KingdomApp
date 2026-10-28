# MyKingdom — sprite-sheet nativi senza render React a ogni passo

## Contesto e perimetro

Esperimento **solo Android/iOS**, nella PR Draft #297 (stacked su #296 e #295).
La PR #294 è un benchmark **web Phaser** distinto. Nessuna modifica a
`MapWandererCharacter.tsx` (web), `GameContext`, dati di salvataggio,
logiche di lavoro, regole di collisione, mappe o velocità di gioco.

La PR #296 aveva già sostituito gli aggiornamenti React della **posizione**
con `Animated.ValueXY.setValue` e accorpato i RAF dei residenti. Tuttavia
il fotogramma della sprite-sheet era ancora una variabile React
(`walkFrame`), aggiornata a intervalli di circa **180 ms** per ogni
abitante in movimento. Con 200 abitanti, la sola animazione del costume
poteva provocare numerosi rendering del corpo del residente, indipendenti
dal cambio di cella, dal tocco e dalla collisione.

## Modifica

- Il componente `MapWandererCharacter.native.tsx` possiede ora un
  `Animated.Value` chiamato `spriteSheetOffset`. L'immagine diventa
  `Animated.Image`, con `left` controllato direttamente dal valore
  animato. La posizione e il target touch rimangono nel loro precedente
  `AnimatedPressable` con `pixelPos.getLayout()`.
- Il modulo puro `NativeResidentSpriteFrameDriver` traduce direzione,
  stato di cammino, tempo trascorso del segmento e dimensione della cella
  nell'offset **assoluto** della sprite-sheet. Pubblica il nuovo valore
  soltanto quando il frame visibile cambia. Non gestisce RAF, pause,
  callback, pathfinding, claim, salvataggi o stato globale.
- La direzione rimane in React solo per l'eventuale specchiamento ovest;
  l'avanzamento del frame e l'inizio/fine del movimento non richiedono
  più `setWalkFrame` o `setIsMoving`.
- Il segmento continua a usare `NativeResidentSegmentProgress`, con
  le stesse velocità 1×/2×/4×, la sospensione del primo RAF dopo il
  background e i callback originali di arrivo/collisione.
- I segmenti consecutivi di un tragitto restano visivamente in cammino;
  il frame si riporta a 0 tra segmenti, e al termine dell'ultimo segmento
  ritorna al frame idle. La direzione ovest continua a specchiare la
  stessa terna di fotogrammi est usata dal renderer precedente.
- Un cambio di `cellSizePx` ricalcola l'offset in `useLayoutEffect`
  senza alterare il progresso del segmento.

## Verifiche automatizzate

`tests/native-resident-sprite-frame-driver.test.ts` confronta i pixel
calcolati con le funzioni di riferimento `frameGroupStart`,
`walkIndexInGroup` e `walkFrameFromElapsedMs`. Copre:

1. Tutte e quattro le direzioni, frame idle e frame in movimento.
2. **200 driver × 300 campioni = 60.000 campioni sintetici**;
   confronta ogni offset con il modello di riferimento e verifica che
   gli aggiornamenti `Animated.Value` siano molto meno frequenti dei
   campioni RAF.
3. Cambi di velocità 1×/2×/4× e ripresa dal background senza avanzamento
   del costume al primo frame di ritorno.
4. Percorsi consecutivi, reset del ciclo, cambio dimensione, remount,
   input non validi e confine nativo/web.
5. Smoke bundle Android/iOS/web nella workflow
   `native-perf-diagnostics.yml`.

**Questi non sono FPS o consumi misurati.** Il test conta pubblicazioni
del valore e verifica l'identità dei pixel, non il tempo del bridge
React Native, i commit React reali, il costo di layout Yoga o la
reattività del tocco sul dispositivo.

## Validazione manuale ancora necessaria

Su **Android fisico e iPhone fisico**, confrontare la baseline #295,
il RAF #296 e l'intero stack #297 con la stessa mappa e 25/50/100/200
abitanti, a 1×/2×/4×. Osservare FPS e p95 frame time dalla diagnostica
native, body render/sec, callback/sec, touch su residenti in movimento,
doppio tap, direzioni est/ovest, transizioni casa/lavoro, collisioni,
pause manuali e ritorno dal background. Segnalare artefatti di
`Animated.Image` (flicker/offset su Android/iOS) e misurare CPU e
batteria con profiler di sistema prima di qualsiasi merge.

## Reversibilità

L'intervento è isolato nella PR Draft #297 e può essere ripristinato
tornando alla gestione precedente `walkFrame`/React; non contiene
migrazioni, modifiche a dati persistenti o deploy. Un fallimento CI
generale per errori TypeScript già presenti non costituisce una
validazione dei file nuovi: la suite mirata e i bundle devono essere
verificati separatamente.
