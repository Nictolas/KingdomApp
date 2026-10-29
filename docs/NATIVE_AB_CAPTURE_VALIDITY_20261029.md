# MyKingdom — affidabilità del confronto nativo A/B (29 ottobre 2026)

**Perimetro:** PR Draft #297, stacked su #296 → #295, senza toccare la baseline Phaser #294, la fixture A/B #298, GameContext, salvataggi, regole di movimento, renderer web o produzione.

## Perché questa modifica

Una misura dichiarata di 10 secondi può essere **ingannevole** se il pannello RAF di sviluppo riceve la prima callback valida molti secondi dopo l'avvio (ad esempio dopo un blocco del thread JS), oppure se alcune callback non vengono osservate ma il delta passato al misuratore è piccolo. La vecchia sessione strict rifiutava gli intervalli >= 2 s *dopo* il primo campione, ma non la perdita dei primi 9 s. Era possibile terminare con un report p95 basato su una frazione della durata dichiarata.

Un secondo difetto di completezza: quando il probe opzionale del ritardo event-loop non aveva prodotto un rapporto, il pannello poteva comunque creare e condividere un risultato con il campo mancante. In un confronto A/B i due report possono così sembrare simili anche se uno è privo della diagnostica del ritardo.

## Protezioni introdotte

1. **Copertura iniziale:** in modalità `requireContinuousFrames`, la prima callback accettabile deve arrivare entro 2 s dall'avvio. Una callback arrivata >= 2 s dopo l'inizio, anche con un delta dichiarato di 16 ms, invalida irrevocabilmente la cattura.
2. **Coerenza intervallo:** il delta RAF fornito all'API viene confrontato con la differenza reale fra due timestamp RAF consecutivi. Discrepanze > 1 ms sono considerate campionamento parziale e invalidano il report. Un vero frame lento di 60 ms rimane campionato come 60 ms, senza essere silenziosamente escluso.
3. **Valori patologici:** timestamp duplicati/regressivi, delta non finiti/negativi/zero e gap >= 2 s invalidano la misura strict. È vietato terminare con un report privo di intervalli validi.
4. **Prove complete:** il pannello esporta la misura solo se i profiler di dispatch e di ritardo JS sono terminati e il secondo ha almeno un campione finito coerente. Se manca una delle due prove, mostra un avviso e chiede di ripetere la misura; non inventa numeri.
5. La modalità non-strict del misuratore, utilizzata da test e API generiche, mantiene intenzionalmente il comportamento precedente.

I controlli si applicano alla **diagnostica nativa di sviluppo**, non modificano timer di gioco, frequenza RAF, velocità 1×/2×/4×, collisioni o touch.

## Verifiche automatiche

- `tests/native-measurement-window-integrity.test.ts`: copertura mancante iniziale di 9 s, prima callback a 2 s, intervalli perduti con delta fittizio, jank autentico di 60 ms, valori non validi, misure vuote, 250 RAF e 200 abitanti simulati ripetuti per 1×/2×/4×, compatibilità della modalità non-strict.
- `tests/native-capture-evidence.test.ts`: profiler completo anche quando nessun residente si muove, report senza heartbeat rifiutato, p95/max invalidi rifiutati, 1.000 cicli di cattura e annullamento tokenizzato.
- I nuovi test sono parte della suite nativa in `.github/workflows/native-perf-diagnostics.yml` e non sostituiscono né aggirano il `Typecheck` generale.

**Limiti rigorosi:** i 200 abitanti, i timestamp e i 250 frame sono *simulati in Node*. Non rappresentano prestazioni di iPhone/Android, FPS UI/GPU, consumo batteria o latenza del touch fisico. Il controllo di coerenza dei delta vale perché il pannello HUD ricava `timestamp` e `frameDeltaMs` dalla stessa callback RAF; non è una regola per clock esterni di diversa origine.

## Validazione necessaria prima del merge

1. Verificare che la suite nativa, il gate TypeScript e i bundle JS Android, iOS, web completino con successo sul **commit più recente** della #297.
2. Conservare SHA-identici i quattro file della fixture A/B real-sprite tra #297 e #298.
3. Installare build *non di produzione* dei due rami sullo stesso Android e sullo stesso iPhone (non basta `expo export`).
4. Misurare almeno tre catture valide per scena a 25/50/100/200 abitanti e velocità 1×/2×/4×, documentando p95 RAF JS, ritardo JS, frame UI/GPU tramite profiler di sistema, touch, pause, collisioni e gli eventuali report rifiutati.
5. Non asserire incremento degli FPS, risparmio energetico o readiness del rilascio finché le prove hardware non sono disponibili.

La CI generale può restare rossa per 53 diagnostiche TypeScript già presenti nella baseline #295; il gate additivo deve comunque dimostrare **zero nuovi errori**.
