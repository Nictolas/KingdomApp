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
