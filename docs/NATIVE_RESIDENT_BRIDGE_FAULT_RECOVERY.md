# MyKingdom — recupero da errori degli scheduler nativi (29 ottobre 2026)

## Perimetro

Intervento sperimentale sulla **PR Draft #297**, stacked su #296 e #295. Tutte le modifiche riguardano esclusivamente il sistema di scheduling dei residenti nativi e la propagazione dello stato pausa/background. Nessun cambio di GameContext, IA, occupazione celle, collisioni, durata movimenti, regole 1×/2×/4×, salvataggi, renderer web, produzione o formato dei dati.

**Motivazione:** un'eccezione di una API host `requestAnimationFrame`/`cancelAnimationFrame` oppure `setTimeout`/`clearTimeout` poteva lasciare un callback logico nel dispatcher senza restituire un handle al residente. Una richiesta RAF successiva avrebbe potuto risvegliare il vecchio callback. Inoltre, durante la pausa, un errore di cancellazione della coda timer poteva interrompere la funzione che avrebbe dovuto fermare anche il bus RAF. Con 200 residenti questo comportamento può essere particolarmente dannoso.

## Cambiamenti coordinati

### 1. NativeResidentFrameBus

- Se una richiesta RAF host fallisce, la registrazione logica nuova viene annullata prima di propagare l'errore: niente sprite "fantasma" al successivo RAF e contatori di registrazioni coerenti.
- Se l'host aveva programmato un RAF prima di lanciare l'eccezione senza restituire il relativo ID, la **generazione nativa viene invalidata** e quel callback eventualmente consegnato in ritardo non può eseguire gli abitanti.
- Se `cancelAnimationFrame` fallisce, l'handle e la generazione vengono invalidati **prima della chiamata al bridge**. Il prossimo residente può richiedere un RAF regolare.
- `setActive(false)` notifica tutti i listener compatibili anche se `cancelAnimationFrame` fallisce. `setActive(true)` continua a notificare i listener anche se la richiesta di un RAF fallisce. La prima eccezione, inclusa una `throw null` o `throw false`, viene conservata e propagata.

### 2. NativeResidentTimerQueue

- Un nuovo timer che non riesce ad armare il timeout host viene rimosso dal min-heap; un callback di piattaforma senza handle non può risvegliare una scadenza sconosciuta. Le precedenti scadenze rimaste valide vengono riarmate con un tentativo best-effort.
- `clearTimeout` non può mantenere artificialmente attivo l'handle dopo un'eccezione: invalidazione della generazione e pulizia dello stato precedono la cancellazione host.
- Il draining cooperativo da **32 callback per wakeup**, il budget soft di **6 ms**, l'orologio virtuale di pausa e le deadline **900/2200 ms** restano invariati.
- Se una callback residente e l'operazione di riarmo della coda falliscono nello stesso wakeup, si preserva l'**eccezione originaria** del residente; entrambe possono essere valori falsy.

### 3. Gate unico di attività

Il nuovo helper puro `applyNativeResidentSchedulerActivity` riceve il valore attivo e invoca **prima la coda timer e poi il bus RAF**, anche se uno dei due lancia un'eccezione. Viene usato dal solo file `nativeResidentFrameLifecycle.native.ts`, senza nuove sottoscrizioni ad AppState, timer o letture di database. Questo evita uno stato "timer in pausa, walker attivi" oppure "walker in pausa, timer attivi" in caso di errore di un bridge.

L'errore rimane visibile al chiamante: l'intervento non nasconde guasti persistenti del runtime nativo, né garantisce il recupero automatico da un bridge permanentemente inutilizzabile. In quel caso può essere necessario riavviare l'app.

## Test automatici di correttezza e stress

`tests/native-resident-bridge-fault-recovery.test.ts` inietta errori su richiesta e cancellazione di entrambi i bridge, anche con valori falsy, prima e durante le transizioni. Gli scenari includono:

- richieste RAF rifiutate seguite da **200 residenti** validi, con callback host obsoleti;
- cancellazione RAF fallita, re-iscrizione di 200 nuovi residenti e assenza di frame fantasma;
- setTimeout fallito senza lasciare scadenze senza proprietario;
- fallimento dell'armamento di una scadenza anticipata e recupero delle **200 scadenze originarie**;
- errore del timer durante background, con 200 walker e 200 timeout, ripresa/rebase, **7 turni** a budget 32;
- errore RAF durante pausa manuale, con 200 timeout ancora correttamente sospesi;
- due guasti simultanei, con propagazione della prima eccezione anche se null;
- **20 cicli di pausa** con 200 animazioni e 200 timer, errori intermittenti, callback stale e cleanup finale completo.

`tests/native-resident-bridge-fault-benchmark.ts` esegue separatamente popolazioni sintetiche da **200 e 1.000 residenti**, con e senza eccezioni host iniettate, in **60 cicli** pausa/background/ripresa per scenario. Registra callback logiche, schedulazioni native simulate, eccezioni gestite e durata CPU di Node. Non impone una soglia assoluta ai millisecondi del runner condiviso.

**Importante:** test e benchmark sono simulazioni JS/Node con callback OS fittizi. Non sono misure di FPS, GPU/UI thread, reattività fisica dei tocchi o consumo energetico. Un ponte nativo che fallisce in produzione resta un'anomalia da investigare tramite log nativi.

## Verifiche di integrazione e rischi

- Il workflow `.github/workflows/native-perf-diagnostics.yml` esegue test e benchmark, il gate additivo TypeScript e tre bundle JS separati (Android/iOS/web). Questi ultimi **non** producono APK/IPA.
- Prima di dichiarare superata questa modifica è necessario verificare il **commit HEAD effettivo** nella PR e il successo completo della sua CI.
- Confermare nuovamente che le quattro fixture A/B sono SHA-identiche tra #297 (ottimizzata) e #298 (pre-ottimizzazione), senza fondere la #298.
- Le simulazioni non sostituiscono la matrice di dispositivo fisico: 25/50/100/200 sprite reali, 1×/2×/4×, tap/doppio tap, zoom, collisioni, background, pause, benchmark UI/GPU su **stesso Android e stesso iPhone** per entrambe le build.
- Un miglioramento nei contatori o una correzione di integrità non deve essere tradotto in percentuali FPS mai misurate.

**Reversibilità:** tutti i commit restano esclusivamente nella PR Draft #297. Nessun merge in main, deploy, rilascio o migrazione.
