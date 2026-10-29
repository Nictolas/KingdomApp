# MyKingdom — dispatch RAF persistente senza iteratori Map per frame (Android/iOS)

## Ambito e motivazione

La PR Draft #297 (stacked su #296 → #295) contiene il dispatcher RAF condiviso per i residenti nativi. Ogni residente che cammina mantiene una sottoscrizione persistente, invece di richiedere una nuova RAF per ogni fotogramma. Con circa **200 residenti**, a 60 callback RAF/s il dispatcher visita circa **12.000 sottoscrizioni/s**; la precedente iterazione `for (const [id, callback] of map)` richiedeva un iteratore Map e coppie `[id, callback]` per ogni attraversamento a livello di semantica JavaScript. Il numero di tuple effettivamente allocate dal motore JS dipende dall'ottimizzazione del runtime e non è stato misurato.

Il percorso persistente usa ora **`Map.forEach` con un visitatore stabile per istanza di dispatcher**. Il visitatore legge timestamp, segnale di ripresa, epoca e ID massimo di inizio frame da campi già esistenti nel dispatcher. Non si crea una closure per ogni frame, né si usa il destructuring delle coppie Map nel ciclo caldo. I buffer riciclati per le richieste one-shot restano invariati.

Non sono cambiati movimento, collisioni, game design, GameContext, salvataggi, renderer web, API del dispatcher, pause o velocità del gioco. Non è una modifica alla PR #298, che rimane baseline A/B con gli stessi quattro file di fixture della #297.

## Invarianti preservate

- Un solo RAF nativo programmato per tutti gli abitanti attivi. Nessun RAF se non ci sono sottoscrittori o durante la pausa/background.
- Gli ID registrati durante una callback **non sono eseguiti nello stesso frame**: la visita controlla il limite di ID acquisito prima dell'inizio della dispatch. `Map.forEach` può enumerare anche nuovi elementi, ma li scarta.
- Cancellazioni durante il frame impediscono le callback degli elementi cancellati. Una pausa, anche seguita da ripresa sincrona, cambia l'epoca e blocca i callback restanti del vecchio frame.
- Il primo frame dopo la ripresa continua a portare `resumedAfterSuspension=true`; gli altri `false`.
- Le eccezioni di un residente non bloccano gli altri. I valori lanciati falsy (compresi `null` e `0`) vengono propagati senza confonderli con l'assenza di errore. Se falliscono sia un one-shot sia un persistente, resta prioritario il primo errore osservato nel one-shot.
- Dopo la dispatch, il riferimento all'errore persistente viene cancellato, evitando di trattenere accidentalmente oggetti di un componente fallito.
- L'ordine delle callback già registrate rimane quello della Map; una sostituzione del residente durante un frame resta un nuovo abbonamento valido solo dal frame successivo.

## Test e benchmark riproducibili

`tests/native-resident-continuous-dispatch.test.ts` verifica quattro gruppi:
1. **200 residenti × 480 frame**: una Map persistente, visitatore stabile, un solo RAF, nessun iteratore Map del percorso persistente (il test rende `entries` e `Symbol.iterator` della Map non invocabili).
2. **200 residenti con mutazioni rientranti**: cancellazione di un fratello, inserimento di un nuovo abbonamento, pausa/ripresa dentro una callback, stale RAF, ordine e segnale di resume.
3. **Errori one-shot e persistenti**: isolamento dei 199 sani, propagazione di `0` e `null`, pulizia del riferimento all'errore.
4. **200 residenti × 2.000 frame**: velocità sintetiche 1×/2×/4×, 20 transizioni background/foreground, otto cicli di unmount/remount di 20 residenti, callback RAF obsolete, nessuna duplicazione o perdita.

`tests/native-resident-continuous-dispatch-benchmark.ts` misura su **Node** due strategie di attraversamento Map e il dispatcher reale, con 200 e 1.000 callback persistenti. I tempi del benchmark sono informativi, non una soglia di CI. L'ordine dei microbenchmark, il JIT e il carico del runner possono cambiare i tempi: un valore inferiore non dimostra FPS più alti, meno GC o migliore latenza touch su Android/iPhone.

Comandi:
```sh
npx tsx --test tests/native-resident-continuous-dispatch.test.ts
npx tsx tests/native-resident-continuous-dispatch-benchmark.ts
```

Entrambi sono integrati nella pipeline `native-perf-diagnostics.yml`. La CI continua a eseguire separatamente i bundle JavaScript Android/iOS/web e il gate TypeScript additivo; nessuno di questi è una prova su telefono fisico.

## Rischi e criteri di validazione

`Map.forEach` può essere più veloce **o più lento** del ciclo `for..of` a seconda del runtime Hermes/JSC, delle mutazioni della Map e del dispositivo. Con molti nuovi iscritti durante una singola dispatch, `forEach` deve enumerare anche gli ID aggiunti e scartarli: ciò può aumentare il lavoro in scenari di churn estremo. Il beneficio ipotizzato è la riduzione del lavoro di iterazione JavaScript, **non** un guadagno di FPS già misurato.

Prima di proporre un merge occorrono: CI nativa verde sul commit esatto, nessuna nuova diagnostica TypeScript, bundle JavaScript completati, fixture #297/#298 ancora SHA-identiche e misure A/B **#298 contro #297** sugli stessi Android/iPhone fisici con 25/50/100/200 sprite a 1×/2×/4×. Registrare separatamente FPS JS, UI/GPU, latenza touch, collisioni, pause e stabilità memoria. Non fare merge/deploy senza autorizzazione specifica.
