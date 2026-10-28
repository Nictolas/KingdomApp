# MyKingdom — Timer nativi condivisi per 200 abitanti

## Obiettivo

L'esperimento PR #296 accorpa i `requestAnimationFrame` dei residenti in un unico ciclo, ma ciascun personaggio continua ad aprire propri `setTimeout` per attendere una passeggiata o riprovare dopo una collisione. Questa modifica consolida le **8 sorgenti di timeout** del solo `MapWandererCharacter.native.tsx`, aggiungendo una coda condivisa e un solo timer della piattaforma per la scadenza più vicina. **Non altera la versione web.**

## Architettura

- `NativeResidentTimerQueue` conserva callback, ID, deadline e tempo residuo in memoria. La coda è condivisa da tutti i personaggi della mappa e mantiene stabile l'ordine tra scadenze uguali.
- Una sola chiamata a `setTimeout` del runtime nativo attende la prossima scadenza. Quando scade, esegue tutte le callback maturate prima del tick e programma la successiva. I nuovi timeout creati durante il tick partono sempre dal tick successivo.
- `cancelNativeResidentTimer` annulla soltanto il lavoro del residente interessato; non cancella i timeout degli altri NPC. Cambio percorso, notte, casa e unmount mantengono le cancellazioni che già esistevano nel componente.
- La coda segue lo stesso `NativeResidentActivityGate` del RAF bus: in pausa o background **non esiste un timeout della coda in attesa**, mentre le scadenze sospese conservano il tempo rimanente. Il ritorno in primo piano non aggira la pausa manuale.
- Scadenze e cancellazioni sono gestite con un numero di generazione: un callback di piattaforma arrivato dopo la cancellazione non può attivare un altro timeout.
- Le decisioni della simulazione, la scelta delle celle, la gestione delle collisioni e la durata nominale attesa di **2200 ms** (idle) e **900 ms** (claim retry) sono preservate.
- Nessun dato di gioco, identificativo residente, posizione o evento viene persistito o inviato.

## Test automatici

`tests/native-resident-timer-queue.test.ts` verifica con orologio e timer finti:

1. 200 abitanti, 200 timeout logici, **1 timeout di piattaforma** prima della scadenza e 200 callback al momento previsto.
2. Scadenze concorrenti da 900 ms e 2200 ms, con ordine stabile.
3. Sospensione a metà attesa, 100 secondi in background, e ripresa mantenendo il tempo residuo.
4. Interazione fra pausa manuale, background e foreground con 200 timer.
5. Nuovi timer mentre il gioco è sospeso e ripresa corretta.
6. Annullamento della scadenza più vicina e di un'altra callback nello stesso tick.
7. Callback create dentro un tick eseguite solo nel successivo.
8. Pausa iniziata dentro una callback, con rinvio delle altre scadenze.
9. Callback nativo obsoleto, cancellato ma comunque consegnato.
10. Smontaggio di 200 residenti in pausa, senza callback residue.
11. Rifiuto di durate non valide.

Il workflow della PR compila anche i bundle JS Android, iOS e web. **Questi test dimostrano il comportamento della coda, non un miglioramento quantificato degli FPS o del consumo energetico.**

## Confronto e validazione su dispositivo

Questa è una PR Draft dipendente dalla #296, che a sua volta dipende dalla #295. Non fondere una PR stacked da sola senza riesaminare le dipendenze. Sullo stesso telefono e con una partita equivalente, confrontare:

- Baseline #295: tutti i timer originali.
- Esperimento #296: frame bus condiviso ma timer per-residente.
- Questo ramo: frame bus e timeout condivisi.

Verificare pause di 1 e 30 secondi, background/foreground, passeggiate, coda per cellule occupate, ripianificazione dei percorsi, turni casa-lavoro, doppio tap, zoom, notte, 1×/2×/4× e scene da 25, 50, 100 e 200 residenti. Misurare FPS JS/UI, p95, invocazioni React, memoria e CPU con strumenti adatti. Al ritorno dalla pausa non devono avvenire né teletrasporti né raffiche di tentativi di claim.

La coda dei timer conserva il **tempo reale di attesa rimanente** in pausa; l'accelerazione 2×/4× si applica già ai movimenti tramite `NativeResidentSegmentProgress`, non automaticamente alla durata dei timeout idle/retry. Modificarla sarebbe una distinta scelta di gameplay.
