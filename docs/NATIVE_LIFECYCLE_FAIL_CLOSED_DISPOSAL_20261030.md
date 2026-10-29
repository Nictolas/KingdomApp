# MyKingdom — chiusura fail-closed del lifecycle nativo (30/10/2026)

## Ambito e problema

Intervento sperimentale **solo nel ramo Draft #297** (stacked su #296).
Il bootstrap unico coordina il timer batch e il frame bus per fino a 200
abitanti nativi. Prima di questa modifica, `dispose()` rimuoveva i listener
AppState/orologio ma **non sospendeva** timer e RAF: una popolazione ancora
registrata poteva continuare a muoversi senza più osservare background o pausa.
Non è un cambio alle regole di gioco né alla versione web.

Una seconda finestra di errore si verificava quando un callback di registrazione
chiamava `dispose()` in modo sincrono: `ensure()` poteva continuare a installare
listener per una generazione già invalidata. Infine, una lettura AppState
transitoriamente fallita in un boot probe asincrono interrompeva i controlli
successivi e poteva lasciare il bootstrap iniziale in stato sconosciuto.

## Modifiche

1. `NativeResidentLifecycleBootstrap.dispose()` invalida la generazione,
   rimuove entrambi i listener e **sospende sempre i due scheduler quando
   possedeva il lifecycle**, anche se una rimozione lancia un'eccezione.
   Preserva il primo errore, compresi `false`, `0`, `null` o `undefined`.
   Il teardown ripetuto non riattiva né ricancella risorse.
2. `ensure()` controlla l'epoch di proprietà dopo l'applicazione iniziale,
   dopo le registrazioni e dopo la riconciliazione: un teardown reentrante
   interrompe l'installazione e il rollback rimane fail-closed.
3. `observeNativeResidentAppVisibility()` tollera una lettura asincrona
   `AppState.currentState` che fallisce, usando **solo** i tentativi di
   bootstrap già previsti (massimo quattro). Se si esauriscono, resta
   in pausa finché non arriva un evento nativo autorevole. Nessun polling
   continuo, nessun timer per abitante, nessun dato persistente.

## Verifiche automatiche introdotte

- 200 iscritti RAF persistenti e 200 timeout logici attraverso **100 cicli**
  di dispose/reinstall, con callback OS tardivi, zero lavoro mentre sospesi
  e un solo listener per sorgente a ogni installazione.
- Dispose reentrante durante l'iscrizione AppState: nessun listener superstite
  e nessun bootstrap erroneamente marcato pronto; installazione successiva
  recuperabile.
- Unsubscribe nativo che lancia un valore falso: i due listener vengono
  rimossi e la sospensione è comunque richiesta.
- Boot probe con errore temporaneo, poi risoluzione: nessuna doppia notifica.
- Quattro letture fallite: zero timer residui, nessun resume spurio,
  recupero su evento `active` successivo.

I test sono **simulazioni JavaScript con bridge OS fittizio**. La pipeline
`Native Performance Diagnostics Tests` deve verificare i test e i bundle
JavaScript Android/iOS/web sul commit risultante. Non costituiscono build
APK/IPA, misure di FPS UI/GPU o test su dispositivi reali.

## Confronto A/B e rischio residuo

#298 resta la baseline sprite reale (motore #296) e #297 la variante
timer batching. #295 resta baseline marker; #294 benchmark Phaser web.
Non sono stati modificati fixture A/B, GameContext, salvataggi, game design,
versione web o produzione. Il nuovo comportamento di `dispose()` è
intenzionalmente fail-closed: dopo un teardown esplicito serve `ensure()`
per riattivare il lifecycle. Il modulo di produzione attualmente espone
solo `ensureNativeResidentFrameLifecycle()`, non un comando di teardown.

Da verificare su Android e iPhone fisici: 25/50/100/200 sprite, velocità
1×/2×/4×, pausa e resume, notification shade Android, collisioni, tocchi,
frame UI/GPU, temperatura e continuità della simulazione. Nessuna misura
hardware è stata effettuata da questo intervento.


## Estensione della validazione — 30/10/2026

### Correzione della pipeline precedente

Sulla revisione `05947c19`, la suite `suite_01` era rossa per
`a canceled native AppState notification cannot control a newer bootstrap`.
Non si trattava di un difetto osservato del scheduler: il test si attendeva
`[true, true]` dopo `ensure() → dispose() → ensure()`, mentre la
semantica fail-closed introdotta richiede correttamente
`[true, false, true]`. Il test ora verifica esplicitamente che la
notifica tardiva della vecchia generazione **non** aggiunga alcuna
pubblicazione e che un vero nuovo `foreground=false` sia ricevuto.

### Matrice integrata aggiunta alla suite di bootstrap

Un singolo scenario parametrico esegue **12 combinazioni**, senza
modificare game design, GameContext, save o web:

- Popolazioni di 25, 50, 100 e 200 sottoscrizioni RAF **persistenti**.
- Velocità 1×, 2× e 4× con `NativeResidentSegmentProgress.sampleInto()`.
- Otto attese logiche per abitante (fino a **1.600 timeout**) nella coda
  cooperativa da 32 callback per risveglio OS.
- Sequenza `foreground → background + pausa → foreground ancora in pausa
  → resume`, con **89,9 secondi** di sospensione simulata.
- Consegna forzata di frame e timer OS già cancellati: devono restare inerti.
- Primo frame dopo resume usato per il *rebase*, senza avanzamento forzato.
- Drenaggio completo di ogni attesa una sola volta; un solo RAF e un
  solo timer OS per intera popolazione; teardown finale senza riferimenti.
- Un altro stress test attraversa **100 generazioni** di bootstrap,
  reiniettando tutte le notifiche delle generazioni precedenti e
  verificando esattamente due listener condivisi mentre attivo.

I risultati CI devono essere valutati sul commit **corrente** e non
sulle pipeline precedenti. Le 12 combinazioni sono **test sintetici
deterministici Node**, non 12 test Android/iPhone, non benchmark FPS, e
non una prova di collisioni o touch fisici.

### Criterio di avanzamento

La stima resta **80% della sola fase native 200 abitanti** finché non
si concludono CI dell'ultimo commit e prove su dispositivi fisici.
I bundle Expo JS (Android/iOS/web) non sono APK/IPA. Verificare
separatamente gli errori TypeScript generali preesistenti.
