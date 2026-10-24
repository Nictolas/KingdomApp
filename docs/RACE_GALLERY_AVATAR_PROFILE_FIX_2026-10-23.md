# My Kingdom — Razze: ritratti invisibili e scheda abitante

Data: 23 ottobre 2026. Correzione dopo PR #273.

## Problema confermato
In `/razze/orchi` e `/razze/umani` alcuni ritratti presentavano un cerchio vuoto pur mostrando nome e conteggio corretto. `resolveCharacterLayers` annulla tutto lo sprite quando non trova anche un singolo elemento grafico dichiarato. Caso concreto riprodotto in test: Nani con corporatura LPC `child` e `child_shirt`/`child_pants` non presenti nel manifest; l'intero sprite, compresi corpo e testa, spariva. Si possono verificare incompatibilità simili per capelli, copricapi e abiti in vecchi salvataggi.

## Correzione
- `aspettoRenderizzabileAbitante` è applicato al risultato di `aspettoPerVisualizzazioneAbitante` dopo le regole di professione/casta/genere/razza. I personaggi già compatibili non vengono toccati.
- Quando uno sprite completo non è renderizzabile, il correttore rimuove soltanto gli elementi inesistenti per la corporatura, cerca un colore compatibile per capelli o barba, e preserva tutti gli altri livelli validi. Solo per combinazioni irrecuperabili usa un aspetto visivo di base mantenendo razza/pelle/testa. Non modifica i salvataggi.
- `AbitanteAvatarPreview` verifica prima l'effettiva renderizzabilità e, nei rari casi irrecuperabili, mostra almeno un simbolo della razza al posto di un cerchio vuoto.
- In `/razze/[razza]`, ogni ritratto/nome/scheda è cliccabile e apre `AbitanteInfoModal` già usato nelle sezioni Abitanti/Lavori; selezione tramite ID, ritrovando l'abitante più aggiornato dalla popolazione corrente; la chiusura restituisce alla griglia.

## Verifiche
- `tests/race-gallery-invisible-avatar-profile.test.ts`: ritratti incompatibili e dati persistiti intatti, nessuna regressione su validi, simulazioni su entrambe le modalità, pulsante e modale.
- Test di navigazione Razze esistenti, test completi, controllo TypeScript e web build.
- Collaudo browser di produzione dopo Vercel READY: clic nella galleria Umani/Orchi, scheda completa e chiusura; verificare che non compaiano più cerchi vuoti. Un campione del salvataggio reale dell'utente può includere dati non coperti dai dati di test.

## Decisioni preservate
- Gli Schiavi restano calvi con unico indumento Short Shorts (Walnut).
- Le Donne non hanno baffi o barba.
- Orchi e Goblin restano verdi; Felix conserva entrambi i livelli di orecchie.
- Nessuna scrittura aggiuntiva ai salvataggi.
