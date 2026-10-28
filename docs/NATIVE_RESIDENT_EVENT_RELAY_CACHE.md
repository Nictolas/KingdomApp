# MyKingdom — relay eventi nativi senza allocazioni per render

## Obiettivo e perimetro

Nel componente `MapWandererCharacter.native.tsx` il genitore aggiorna spesso gli handler di tocco, arrivo, occupazione e collisione. La PR #297 già usa `NativeResidentCallbackRelay` per conservare l'identità degli otto handler attraverso gli aggiornamenti del genitore, senza costringere i 200 sprite a un rerender. Tuttavia `bound(props)` creava comunque un nuovo oggetto con otto campi **per ogni render del wrapper**, anche quando presenza e identità degli handler inoltrati non cambiavano.

L'intervento è limitato al relay nativo e alle sue prove. Nessuna modifica al renderer web Phaser, al game design, al motore delle collisioni, a `GameContext`, ai salvataggi o alle build di produzione.

## Implementazione

- Il relay mantiene **un singolo oggetto mutabile** con i soli otto handler correnti (`onPress`, `onDoublePress`, `onCommuteComplete`, `onCommuteBlocked`, `onCellSettled`, `isCellFreeForMe`, `tryClaimCell`, `releaseMyCell`). Non conserva più l'intero oggetto di proprietà del componente, che può contenere percorsi, dati grafici o altri riferimenti non necessari. Il target viene aggiornato soltanto dal layout effect di React, come in precedenza: **le closure di un render abortito non diventano operative**.
- `bound(presence)` calcola una **maschera di presenza a 8 bit**. Una cache locale a ciascun residente memorizza il gruppo di riferimenti stabili per quella maschera. Render consecutivi con gli stessi handler *presenti* (anche se cambiano le funzioni effettive del genitore) restituiscono **lo stesso oggetto**, non un nuovo set di otto campi.
- Se un handler opzionale appare/scompare (es. da abitante non interattivo a selezionabile, oppure viene disabilitata la prenotazione di una cella), la maschera cambia e viene scelta una configurazione differente. I callback effettivamente invocati restano quelli dell'**ultimo commit**, non quelli dell'ultimo render ipotizzato.
- La cache può contenere al massimo **256** oggetti per residente (2⁸ combinazioni), normalmente **uno o pochi**. Ogni oggetto conserva solo le funzioni delegate interne al relay: le vecchie closure del genitore non vengono catturate dalla cache. Nessun polling, network, storage o identificatore personale.

## Verifiche sintetiche automatiche

1. `tests/native-resident-relay-caching.test.ts`: 200 residenti × **1.000** aggiornamenti del genitore con verifica dell'identità delle funzioni, **e dell'oggetto** associato alla stessa maschera; test esaustivo di tutte le 256 maschere; alternanza di interattività e pulsanti/pass-through per 200 residenti; render concorrente abortito; 200 sostituzioni dei callback di collisione e arrivo; accertamento che il relay non conservi l'intero oggetto con grandi array di percorso.
2. `tests/native-resident-relay-cache-benchmark.ts`: confronto con il precedente modello (un oggetto di binding per render) per **200 residenti e 1.000 render**; nel modello iniziale sono 200.000 oggetti di binding; nel modello nuovo, con due configurazioni di presenza, sono **400 oggetti di binding residenti**. L'asserzione compara anche la semantica degli handler.
3. Il workflow `native-perf-diagnostics.yml` esegue entrambi oltre ai test nativi precedenti, allo stress dei timer e al gate TypeScript additivo.

**Limiti:** il benchmark conta gli oggetti creati esplicitamente dal relay, **non** le allocazioni totali React, il GC, i frame UI/GPU, i costi del bridge, o la latenza di un tocco fisico. Una cache per abitante può mantenere una piccola quantità di memoria addizionale fra un render e l'altro, in cambio di minore churn. La validazione finale richiede la CI completa e misure A/B #295 contro #297 su smartphone reali.

## Prima di qualsiasi merge

La #297 resta Draft e dipendente dalla #296, a sua volta dipendente dalla #295. Confrontare i log TypeScript, verificare unit/integration/stress e i bundle JS di Android/iOS/web, quindi misurare su dispositivi reali scene con 25/50/100/200 residenti a 1×/2×/4×, compresi tap, doppio tap, collisioni, background e pausa. **Nessun deploy o merge automatico.**
