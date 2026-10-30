# MyKingdom — tap e doppio tap degli abitanti su Android/iOS

## Problema verificato (28 ottobre 2026)

La componente `MapWandererCharacter.native.tsx` riconosceva il doppio tocco tramite `Date.now()` e un timestamp conservato nel componente. Cambiamenti dell'ora del dispositivo, un primo tap appena prima di una transizione background/foreground o un passaggio del tocco alla griglia potevano lasciare un primo tap ancora valido. Un secondo tap entro la soglia dei **400 ms** rischiava così di aprire la scheda anziché iniziare una nuova coppia di tocchi.

L'ottimizzazione è **solo nativa** e risolve una questione di correttezza della risposta al tocco, non modifica le regole di selezione del gioco o la versione web Phaser.

## Modifiche end-to-end

1. Nuovo modulo puro `src/performance/nativeResidentTapRecognizer.ts`, indipendente da React Native: usa il timestamp monotono `performance.now()`, verifica che sia finito e non regressivo, e mantiene uno stato costante per abitante. **Non programma alcun timer** e non alloca oggetti per tap.
2. Conservato il comportamento della selezione: **il primo tap richiama immediatamente `onPress`**, se presente; il secondo tap entro **meno di 400 ms** richiama `onDoublePress` al suo posto; il terzo tap avvia una nuova coppia. Se il personaggio espone solo `onDoublePress`, il primo tap arma la coppia senza chiamare `onPress`. Esattamente 400 ms non sono un doppio tocco.
3. Il listener nativo già esistente degli stati pausa/background ripulisce il primo tap in sospeso quando il gioco diventa inattivo. Il `React.useLayoutEffect` sulla componente controlla se il tocco viene intercettato o lasciato passare alla griglia e se il secondo handler è presente: un cambiamento della disponibilità del doppio tocco interrompe la coppia incompleta. Il riconoscitore viene ripulito anche allo smontaggio.
4. Il nuovo classificatore restituisce soltanto `single` o `double`; invoca sempre i gestori di eventi già inoltrati dal relay stabile della componente **dopo il commit**, senza catturare una closure obsoleta del genitore.

## Test riproducibili (non test fisici touch)

`tests/native-resident-tap-recognizer.test.ts` esegue regressioni sulla soglia 400 ms, timestamp 0, regressione dell'orologio, `NaN`, `Infinity`, tripli tocchi, presenza opzionale degli handler, passthrough, cancellazione per pausa/background, **200 abitanti** indipendenti, **40 cicli pausa/ripresa con 200 listener**, **10.000 tocchi simulati**, aggiornamenti degli handler tramite relay e isolamento dal file della versione web. I test controllano i risultati logici, **non** la latenza di consegna di un evento fisico da parte di React Native.

La suite è inclusa nel workflow `.github/workflows/native-perf-diagnostics.yml` accanto al gate TypeScript, alle simulazioni RAF/timer, agli stress test di 200 residenti e ai bundle JS Android/iOS/web.

## Validazione su smartphone prima del merge

Su Android e iPhone reali, con una **build di sviluppo** della baseline #295 e una della #297, provare almeno 25/50/100/200 abitanti a 1×/2×/4×. In particolare: tap singolo, doppio tap lento e veloce, tocchi su residenti diversi, tocco in prossimità dell'ingresso di casa che deve essere inoltrato alla griglia, cambio modalità costruzione/demolizione, sospensione e ritorno entro 400 ms, pausa di gioco, tap con frame JS impegnato. Verificare che non si aprano schede involontarie, che i singoli tocchi rimangano immediati e che le animazioni non subiscano regressioni.

**Limiti e rischi**: la soglia dipende ancora dal momento della callback JS di `Pressable`, non dall'istante fisico in cui il dito ha toccato il pannello. I test sintetici non misurano input latency, risposta aptica, UI-thread FPS o performance su dispositivo. Il nuovo riconoscitore è interno alla versione nativa e non cambia l'API dei componenti, il motore web, `GameContext` o i salvataggi. PR #297 resta Draft, stacked su #296 → #295; nessun merge, deploy o rilascio.
