# Sperimentazione: movimento residenti senza rerender React per ogni pixel

> PR sperimentale **stacked** sopra la baseline diagnostica mobile #295.
> Non e' una misurazione di prestazioni e non deve essere fusa senza prova reale.

## Ipotesi e modifica

Il vecchio `MapWandererCharacter` chiamava `setPixelPos({x,y})` da ogni `requestAnimationFrame`. Con 200 personaggi in movimento, queste chiamate possono causare molte invocazioni di render React. Questa sperimentazione mantiene **gli stessi 2 percorsi RAF** (passeggiata e pendolarismo), la stessa durata dei passi e gli stessi callback di occupazione delle celle, ma sostituisce lo stato React per la posizione con un `Animated.ValueXY` persistente per personaggio.

- `pixelPos.setValue({x,y})` viene applicato ai layout `left/top` dei componenti animati, senza richiedere reconciliation React per ciascuna variazione di pixel.
- Lo sprite cliccabile usa `Animated.createAnimatedComponent(Pressable)`, affinche' l'area di tocco si sposti con il personaggio; gli sprite non interattivi usano `Animated.View`.
- Direzione, frame della camminata, arrivo e occupazione continuano ad aggiornare lo stato e le callback esistenti.
- Non si usa `useNativeDriver: true`: `left/top` non sono supportati dal driver nativo per animazioni in layout. Il calcolo resta sul thread JS e va misurato su hardware.
- Nessuna modifica ai salvataggi, alla gestione della popolazione, agli orari, alla durata dei passi, alle collisioni o all'IA.

## Protocollo A/B

1. Su **stesso dispositivo fisico** e stessa partita, misurare #295, poi questa PR con lo stesso protocollo e un ordine alternato nelle ripetizioni.
2. Annotare **FPS JavaScript, p95, callback animazione abitanti/s e invocazioni React abitanti/s**, separando unita' ferme, una popolazione mista e molti residenti in movimento.
3. Verificare visivamente e con tocchi: animazione, hitbox del personaggio durante il movimento, doppio tap, entrata negli edifici, occupazione e rilascio delle celle, pause e accelerazione del tempo.
4. Monitorare l'eventuale aumento della memoria e dei tempi di tocco. Valutare anche FPS del **thread UI** con strumenti della piattaforma.
5. Il fatto che il numero di invocazioni React diminuisca non garantisce un incremento degli FPS; la metrica va confrontata con il baseline e non presentata come miglioramento effettivo senza risultati.

Il benchmark Phaser web #294 e' distinto e **non** utilizzabile per validare questa ottimizzazione React Native.

## Correzione della pausa delle animazioni

La precedente logica di movimento usava `(performance.now() - start)` per entrambi i tipi di passo, anche quando la pausa di gioco sospendeva il movimento: un residente poteva quindi completare improvvisamente il passo alla ripresa. Ora `PauseAwareMotionClock` esclude dalla durata del segmento le finestre di pausa e conserva lo stesso frame della camminata. Test automatici verificano pausa lunga, ripresa, timestamp non validi e segmenti indipendenti.

Questa correzione e' **funzionale**, non un guadagno FPS e non deve essere interpretata come benchmark. Per confrontare esclusivamente l'ottimizzazione `Animated.ValueXY`, non usare le pause durante la finestra di misurazione, perche' il ramo sperimentale contiene anche questa correzione. Verificare comunque manualmente che pausa/ripresa non teletrasportino e che la durata dei passi resti coerente.

## Correzione dell'attesa per collisione durante pausa

La revisione di `MapWandererCharacter` ha identificato un caso concreto: quando un tragitto viene bloccato da una cella occupata, `runOneSegment` prepara un nuovo tentativo tramite `idleTimerRef`. La pausa globale annulla quel timer con `clearIdle()`, ma al resume il precedente effetto ignorava tutti i tragitti attivi: il personaggio poteva **rimanere bloccato indefinitamente**.

Il ramo sperimentale ora:
- Trattiene la continuazione del segmento in `PendingCommuteRetry` quando la cella e' occupata o l'orologio e' in pausa.
- Non richiede celle e non avvia passi mentre il tempo di gioco e' fermo.
- Quando la pausa comincia, annulla il timer senza scartare la continuazione; alla ripresa tenta il segmento **una sola volta** senza ricominciare da casa.
- Scarta la continuazione se il tragitto cambia o il componente viene smontato, evitando che un vecchio tentativo interferisca con un percorso nuovo.
- Conserva l'attesa `CLAIM_RETRY_MS` negli scenari senza pausa e la logica esistente del numero massimo di tentativi.

I test puri verificano recupero, consumo singolo, invalidazione del vecchio tragitto e sostituzione del tentativo. **Non costituiscono ancora una prova end-to-end delle collisioni su dispositivo fisico**. La convalida manuale deve riprodurre due residenti sulla stessa strada, pausa durante la coda, ripresa, avanzamento e collisioni residue.

## Isolamento web e native (28 ottobre)

L'audit successivo ha rilevato che la prima implementazione dell'esperimento aveva cambiato `MapWandererCharacter.tsx`, componente condiviso anche dal web. La modifica e' stata **spostata integralmente** in `MapWandererCharacter.native.tsx` per Android e iOS; il componente standard `MapWandererCharacter.tsx` e' tornato **identico al contenuto della baseline #295**.

L'import in `app/mappa.tsx` rimane senza estensione, consentendo al resolver di Metro di scegliere il file specifico della piattaforma. Un test di regressione verifica separazione, parita' dei props e import. La CI esegue i bundle Android, iOS e **web**; solo il loro esito fornisce evidenze di compilazione, non prestazioni o comportamento su smartphone. Questa PR resta Draft e non deve modificare la versione web.
