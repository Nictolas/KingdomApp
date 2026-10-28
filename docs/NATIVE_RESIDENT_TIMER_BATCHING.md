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

## Diagnostica confrontabile e orologio monotono (28 ottobre)

La prima implementazione della coda usava `Date.now()`, che segue l'orologio di sistema. Una correzione dell'ora del dispositivo (o sincronizzazione automatica) non deve abbreviare o ripetere i tempi residui dei residenti. La coda ora legge **`performance.now()`**, monotono, e difende anche i clock di test da campioni non finiti o regressivi. L'attività è sempre controllata dal gate foreground/pausa: nessuna attesa simulata deve procedere durante una sospensione.

Sono disponibili contatori aggregati soltanto in memoria:
- **Timer residenti in attesa:** quante callback logiche sono programmate; non identifica alcun abitante.
- **Timeout nativi attivi:** 0 o 1 (unico risveglio della coda).
- **Wakeup timeout nativo:** numero di callback del timer di piattaforma effettivamente accolte.
- **Callback timer residenti:** numero di callback logiche processate, a prescindere dall'esito.
- **Timeout nativi programmati/annullati:** numero cumulativo di operazioni di scheduling/cancellazione, utile per individuare churn e riarmi inutili.

L'HUD di sviluppo presenta valori assoluti e tassi al secondo. Il rapporto condivisibile, generato **solo su richiesta esplicita dell'utente** con una misura di 10 secondi, include le differenze aggregate dei contatori oltre a FPS e p95 JS. Non sono salvati o trasmessi automaticamente dati personali, posizioni, ID abitante, percorsi o altri dati di gioco. I contatori **non costituiscono FPS UI/GPU, misure CPU o prove di risparmio batteria**.

Il test `native-resident-timer-diagnostics.test.ts` aggiunge:
- 200 callback residenti con 1 wakeup timeout finto: il rapporto 200:1 è un'invariante **sintetica** del dispatcher quando i 200 timer hanno la stessa scadenza.
- Orologio con salto all'indietro, callback OS obsoleti e gestione degli errori senza affamare gli altri residenti.
- Calcolo dei tassi aggregati, reset contatori, durata non valida e rapporto italiano di 10 secondi.
- 1.000 timeout logici con scadenze miste, cancellazioni, pausa/background, ripresa e ordine di esecuzione, verificando che resti al massimo 1 timeout del sistema programmato in ogni momento.

Queste sono **prove di correttezza** della coda e della diagnostica; non sostituiscono il confronto con #295/#296 sullo stesso iPhone/Android reale. Per misurare il risparmio energetico, registrare inoltre il consumo tramite profiler di sistema in un'esecuzione sufficientemente lunga.

## Coda a priorità indicizzata: eliminazione delle scansioni per ogni timer

Il primo prototipo di `NativeResidentTimerQueue` utilizzava una `Map` di callback e cercava il deadline minimo con `tasks.values()` ogni volta che un residente programmava o annullava un'attesa: con molti residenti, il costo complessivo poteva crescere quadraticamente in uno scenario di registrazioni/cancellazioni massive.

La nuova versione usa un **min-heap ordinato per `(dueActiveMs, id)`** e una mappa `id → posizione nell'heap`: inserimenti e cancellazioni sono **O(log n)**, l'accesso alla prima scadenza è **O(1)**; non è più necessaria la ricerca lineare a ogni operazione. La cancellazione di un timer non deve riesaminare o spostare tutte le scadenze.

Il tempo simulato della coda è un **orologio virtuale attivo** derivato da `performance.now()`. Quando il gioco è in pausa o l'app è in background, non accumula tempo: ogni attività conserva naturalmente la propria deadline virtuale, senza iterare sulle 200+ attività né spostare le scadenze all'uscita dalla pausa. Le notifiche della sospensione e della ripresa sono **O(1)** rispetto al numero di timer, escludendo il normale riarmo dell'unico timer OS. I cambi manuali all'orologio di sistema non alterano le scadenze.

I timer già scaduti al momento del wakeup vengono temporaneamente estratti dal heap in un batch separato. Questo evita di richiamare immediatamente callback create da un altro callback dello stesso tick e permette di cancellare singole callback del batch. Se una callback avvia la pausa, le attività non ancora elaborate tornano nel heap mantenendo ordine e scadenze.

**Nuovi stress test sintetici (non benchmark FPS):** `native-resident-timer-diagnostics.test.ts` verifica 10.000 scadenze con deadline differenti e cancellazioni in ogni zona del heap, correttezza e unicità dei callback, ordine stabile per deadline e registrazione, un solo timeout del sistema per volta, annullamenti mentre un batch è in corso, e pausa nel mezzo di 200 callback mature.

Queste verifiche riguardano **correttezza e complessità algoritmica**; un miglioramento misurato di CPU, batteria o FPS su dispositivo non è ancora documentato.

### Confronto con modello di riferimento indipendente

Per proteggere il refactor da errori difficili da vedere in un test predefinito, il nuovo `tests/native-resident-timer-model-comparison.test.ts` confronta **4.000 operazioni pseudo-casuali con seme fisso** contro un modello lento e deliberatamente semplice basato su `Map` e scansioni. Il modello e' un *oracolo di correttezza*, non la soluzione di produzione.

Il test mescola inserimenti con delay differenti, cancellazioni, avanzamenti di clock, pause e riprese, verificando dopo ogni operazione l'attivita', la prima scadenza e il numero di callback ancora presenti. Ad ogni wakeup confronta la sequenza di callback con quella del riferimento e verifica che non vi siano duplicazioni. Un seme costante permette di riprodurre gli stessi scenari e gli eventuali fallimenti in CI.

**Limiti:** l'oracolo verifica il comportamento logico e non il touch, le collisioni reali o le prestazioni su un dispositivo. La CI generale puo' ancora fallire per errori TypeScript non collegati; non confondere la riuscita di questa suite con una release pronta.
