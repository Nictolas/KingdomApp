# MyKingdom — gate di completezza per la matrice A/B nativa (29 ottobre 2026)

**Perimetro:** confronto offline tra #298 (sprite reali, baseline prima delle ottimizzazioni #297) e #297 (candidato). Solo report JS generati sul dispositivo; nessuna modifica a renderer, gameplay, GameContext, salvataggi, web, distribuzione o produzione.

## Problema corretto

Il controllo precedente accettava tre report per lato con almeno 100 campioni ciascuno e durata dichiarata di 10 secondi. Un file con 120 campioni a 16 ms descrive però circa **1,92 s di intervalli osservati**, non 10 s: la statistica p95 può così escludere molti secondi di blocco del thread JS pur apparendo completa. La #297 invalida già alcuni buchi RAF durante la cattura; l'analisi offline ora applica una verifica indipendente anche ai file esportati e alla baseline #298.

Inoltre il confronto accettava un candidato #297 privo del ritardo del loop JS o del numero di batch RAF, omettendo semplicemente la metrica dal confronto. Un risultato incompleto non deve essere scambiato per un confronto valido.

## Gate implementati

- **Copertura dei frame per ogni cattura:** `Campioni × Frame medio / Durata` deve essere compreso fra **0,80 e 1,15**. La tolleranza tiene conto degli intervalli iniziali/finali e dell'arrotondamento del frame medio. Non è una misura del frame pacing GPU né garantisce l'assenza di intervalli persi più piccoli.
- **Prove obbligatorie del candidato #297:** presenza di `Batch RAF JS campionati`, `Batch RAF JS p95`, `Ritardo loop JS campioni`, `Ritardo loop JS p95`. Il ritardo del loop deve avere almeno un campione; una scena con residenti in movimento/tragitto deve avere almeno un batch RAF campionato.
- **Eccezione motivata per scena ferma:** zero batch RAF è consentito solo per `Sprite abitanti reali fermi`, ma il probe del ritardo JS resta obbligatorio.
- **Compatibilità della baseline #298:** i campi dei probe rimangono opzionali per i report storici della baseline, senza interpretarli come zero o come prova di miglioramento. Se presenti, i contatori devono essere interi non negativi e sicuri.
- **Matrice ancora advisory:** dodici scenari per piattaforma (25/50/100/200 × 1×/2×/4×), almeno tre acquisizioni per versione e scenario; i report non dimostrano che i dispositivi siano identici, che i tocchi siano fluidi o che gli FPS UI/GPU migliorino.

## Verifiche

`node --test tests/native-ab-matrix.test.mjs tests/native-js-report-comparison.test.mjs` copre report incompleti o gonfiati, probe mancanti, contatori malformati, scene ferme e compatibilità storica. La suite è già parte del workflow `Native Performance Diagnostics Tests`; i bundle JavaScript Android/iOS/web e il gate TypeScript restano verifiche distinte.

**Limiti:** non sono state eseguite misure su Android/iPhone fisici, non si deducono FPS o latenza touch dal prodotto dei campioni per la media, e la CI generale può restare rossa per errori TypeScript preesistenti. Nessun merge della #297/#298 senza A/B hardware e revisione dei risultati.
