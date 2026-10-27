# MyKingdom — baseline diagnostico Android/iPhone

## Ambito

Il gioco finale e' Android/iOS. Il renderer Phaser `PhaserMapSurface.web.tsx` non e' usato in produzione nativa. Il file `PhaserMapSurface.tsx` e' un placeholder nativo; la mappa principale in `app/mappa.tsx` su mobile usa viste React Native. Il precedente import comune da `react-zoom-pan-pinch` puntava a una libreria browser/DOM. Ora `MapViewportTransform.web.tsx` preserva quella implementazione soltanto sul web, mentre `MapViewportTransform.tsx` definisce il pan e pinch native tramite `PanResponder` e `Animated.View`. **Nessun test su smartphone fisico e' stato ancora eseguito**, quindi compatibilita' gesture, hitbox, velocita' e animazione restano da verificare. Gli FPS del browser/SwiftShader nella PR #294 non sono una prova mobile.

## Cosa e' stato aggiunto

- **Mappa reale**: durante lo sviluppo Android/iOS, pulsante "JS FPS" sopra la mappa (tap per espandere), con FPS della callback JavaScript requestAnimationFrame, media frame, p95 e numero abitanti reali + celle in viewport. Il monitor si arresta quando la schermata perde il focus.
- **Scena diagnostica**: dalla mappa, "Prova 25–200 elementi" conduce a `/native-perf`. Simula 25/50/100/200 **semplici marker React Native** (non sprite grafici LPC, non NPC) su una scena fissa da 200 celle. E' possibile attivare/disattivare l'animazione, per stimare il costo marginale delle view. Nessuna mutazione dello stato di gioco, della popolazione o dei salvataggi; la rotta diagnostica non e' disponibile in build di produzione.
- **Calcolo metriche**: finestra mobile massima 120 frame; p95 della durata delle callback RAF; intervalli di sospensione in background esclusi; nessuna rete, log utente, file o telemetria persistente.
- **Test CI**: fixture deterministiche e formule delle metriche.

## Protocollo sui dispositivi

1. Su dispositivo **Android fisico** e **iPhone fisico**, eseguire una **build di sviluppo** del ramo della PR; non usare simulatori per i risultati finali. Attivare il performance monitor di React Native e il profiler GPU/UI thread del sistema. Non usare la modalita' remote JS debugging; considerare la build diagnostica come indicativa, non equivalente alla release.
2. Verificare che `/mappa` sia **effettivamente funzionante su native**: rendering, trascinamento, pinch-zoom centrato sotto le dita, selezione celle, edifici, residenti e hitbox dopo lo zoom. Se il nuovo `MapViewportTransform.tsx` presenta anomalie, registrarle come blocco e non inferire performance della mappa dalla sola scena sintetica.
3. Misurare il comportamento della **mappa reale** con popolazione realmente esistente, senza crearne di fittizia nei salvataggi. Annotare: marca/modello, OS, dimensioni schermo, build, stato termico, abitanti totali, camera, FPS JS, FPS UI/GPU e memoria del sistema.
4. Aprire `/native-perf`. Testare 25, 50, 100, 200 marker; per ogni prova eseguire 10 secondi fermi + 10 secondi animati dopo il riscaldamento. Annotare almeno tre ripetizioni e riportare dispersione; alternare l'ordine dei conteggi in sessioni ripetute per minimizzare l'effetto termico.
5. Tornare alla mappa e verificare che i salvataggi, gli abitanti veri e le azioni restino invariati. Nessun merge della PR prima di correggere eventuali regressioni.

## Cosa questi numeri NON misurano

- `JS FPS` e' il ritmo degli eventi requestAnimationFrame del thread JavaScript, **non** FPS del renderer, GPU o UI-thread; FPS JS puo' restare alto mentre il rendering nativo rallenta.
- La scena sintetica **non** misura 200 abitanti con bisogni, lavoro, IA, pathfinding, occupazione celle o asset LPC multistrato.
- Non abbiamo ottenuto misure native reali nella CI cloud. Il test automatico con 25/50/100/200 valida solo generazione e correttezza delle metriche.

## Decisioni

Nessun cap rigido di 200 abitanti; nessuna modifica a simulazione, velocita' 1x/4x, logiche del gioco, PR #294, salvataggi o rilascio. Soglie 30/60 FPS sono obiettivi futuri da convalidare con i dispositivi reali.

## Risoluzione della dipendenza browser

- `app/mappa.tsx` usa `../src/components/MapViewportTransform`.
- Metro sceglie `.web.tsx` sul web e `.tsx` su Android/iOS. Questo evita di importare il renderer di gesti HTML sul mobile.
- Native calcola pan e zoom in coordinate mondo; la logica pura in `src/game/nativeMapTransform.ts` verifica centro iniziale, focal point durante pinch e limiti zoom con test dedicati.
- PanResponder e un punto di compatibilita' per la prima baseline, **non** una garanzia di 60 FPS. Confrontare UI thread e JS FPS sul telefono; per il rendering nativo definitivo potra' servire un'implementazione su gesture handler/Reanimated.
- **No deploy/merge** prima di una prova con dispositivi fisici e regressioni di interazione.
