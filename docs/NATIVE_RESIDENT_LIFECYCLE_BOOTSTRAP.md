# MyKingdom — lifecycle bootstrap atomico per i residenti nativi (29 ottobre 2026)

## Motivazione e perimetro

Nella PR Draft **#297**, il vecchio modulo `nativeResidentFrameLifecycle.native.ts` impostava `initialized=true` **prima** di creare il gate pausa/foreground e prima di sottoscrivere gli eventi React Native e dell'orologio di gioco.

Se la prima pubblicazione dello stato, la registrazione di `AppState` o la sottoscrizione dell'orologio falliva, la funzione avrebbe potuto lasciare `initialized=true` senza entrambi i listener; tutte le successive chiamate di `ensureNativeResidentFrameLifecycle()` sarebbero state ignorate. Con 200 sprite, una pausa o il background potrebbero quindi non sospendere i timer e il RAF correttamente. I test del bridge già introdotti coprivano i guasti **dopo** l'inizializzazione, non il bootstrap incompleto.

Questo intervento resta confinato alla **simulazione e diagnostica native Android/iOS**. Non modifica GameContext, persistenza, renderer Phaser web, collisioni, ritmo di gioco, algoritmi di cammino o controllo 1×/2×/4×. Nessuna funzione nuova per singolo residente.

## Architettura implementata

1. `NativeResidentLifecycleBootstrap` è un controller puro e condiviso che si inizializza **una volta sola** per l'intera popolazione, indipendentemente da 25/50/100/200 sprite o dalla loro frequenza di mount.
2. In `ensure()` il gate crea lo stato iniziale, poi installa **uno** subscription all'orologio di gioco e **uno** ad `AppState`. Soltanto alla fine della sequenza il controller si dichiara `initialized`.
3. Una eccezione da qualunque fase rende l'installazione **ritentabile**, invalida le callback native tardive, rimuove le sottoscrizioni già installate e pubblica best-effort una pausa a **entrambi** gli scheduler per non lasciare animazioni vive senza listener.
4. L'installazione rilegge foreground e pausa dopo aver installato le due sottoscrizioni. Il controllo copre eventi cambiati tra la prima lettura e l'ultima sottoscrizione, senza un nuovo timer o polling.
5. Un token di generazione protegge dalle notifiche `AppState` consegnate dopo `remove()`. Gli unsubscribe sono idempotenti e in caso di errori multipli conservano il primo errore.
6. `NativeResidentActivityGate` conserva un flag `needsReconcile` soltanto dopo errori di pubblicazione. Un evento duplicato con lo stesso stato può **ripetere un tentativo fallito**; quando il gate è sano i duplicati restano no-op e non aggiungono lavoro per frame.
7. `NativeResidentFrameBus` e `NativeResidentTimerQueue` possono riarmare lavoro pendente su una ripetizione dello stato `active=true`, pur mantenendo la semantica idempotente quando il RAF/timeout esiste già. Non vengono aggiunti callback di piattaforma se la coda è vuota.
8. La singola integrazione React Native continua a delegare l'ordine timer → RAF all'helper `applyNativeResidentSchedulerActivity` della #297.

## Matrice di test automatica, soltanto Node

`tests/native-resident-lifecycle-bootstrap.test.ts` include:
- **200 sprite / 1.000 chiamate duplicate** a `ensure` con esattamente due listener globali;
- eccezione `throw undefined` durante la prima applicazione, fail-closed e nuova installazione completa;
- errore `throw false` della sottoscrizione `AppState` dopo l'installazione del listener di pausa, con pulizia e retry;
- state drift durante il bootstrap (foreground e pausa cambiano mentre si stanno installando i listener);
- eventi `AppState` di una generazione dismessa, che non devono cambiare il gate nuovo;
- resume che fallisce con `throw 0`, ripetuto con lo stesso evento senza aggiungere listener;
- **200 sottoscrizioni RAF persistenti + 200 timer**, con fallimento di un RAF durante la ripresa, secondo evento che recupera, ripresa senza teletrasporto e **sette** turni timer da 32 callback;
- recupero di guasti iniziali `throw null` e **200 cicli** di foreground/background senza listener duplicati.

`tests/native-resident-lifecycle-bootstrap-benchmark.ts` esegue 240 transizioni sintetiche con 200 e 1.000 residenti e conta: chiamate a `ensure`, listener installati, pubblicazioni di stato e durata Node locale. Il conteggio previsto dei listener è **uno foreground + uno clock** indipendentemente dalla popolazione.

Le suite sono integrate nella pipeline nativa. Non dichiarare superata la nuova implementazione finché la pipeline dell'**ultimo SHA** non è completata con esito positivo.

## Limiti e rischi residui

- I test e il benchmark usano **scheduler e orologi fittizi**. Non misurano FPS Android/iPhone, latenza hardware dei tocchi, GPU/UI thread o consumo batteria.
- La ripetizione di uno stato `active=true` consente un recupero da guasti **transitori**; un bridge definitivamente rotto non è automaticamente riparabile e può richiedere un riavvio.
- Il bootstrap registra i listener per la durata della sessione nativa. La funzione `dispose()` esiste per test e teardown esplicito, non cambia il ciclo di vita normale.
- Restano indispensabili il confronto su **dispositivi fisici** fra **#298 (baseline real-sprite)** e **#297 (ottimizzata)** a 25/50/100/200 abitanti, velocità 1×/2×/4×, pause/background, collisioni, tap/doppio tap; usare profiler UI/GPU di sistema. **#295** resta baseline di marker semplici, **#294** benchmark Phaser web.
- La CI generale continua ad avere 53 errori TypeScript nella baseline #295; il gate additivo non deve accettare errori nuovi. I bundle JavaScript Android/iOS/web sono compilazioni di fumo, non APK/IPA installabili.

Nessun merge, deploy, rilascio o modifica alla produzione. Tutti gli interventi sono reversibili nel ramo Draft della #297.
