# My Kingdom — Goblin sempre verdi, baffi e barba editor, Donna senza barba

Data: 23 ottobre 2026

## Motivazione e diagnosi
La release precedente (#269, Vercel READY) conteneva i valori verdi `orc_green`, ma in alcuni casi reali la combinazione dei layer LPC per Goblin bambini non era renderizzabile (esempio riprodotto: Goblin di 7 anni con capelli child_wavy black). La semplice verifica del tono pelle memorizzato non rilevava il difetto.
È stato corretto anche il mapping secondario `lpcRaceId("Goblin")` da `halfling` a `goblin`.

## Regole
- In visualizzazione Goblin, il sistema impone sempre razza LPC `goblin` e pelle `orc_green` prima di disegnare. Verifica che siano disponibili sprite corpo e testa nelle animazioni idle e walk. Solo se una combinazione legacy è incompatibile rimuove prima le componenti non compatibili, conservando il resto per quanto possibile. Non cambia il salvataggio originale.
- Nell'editor di creazione/modifica del Re è disponibile la scheda **Baffi e barba**, con opzioni **Nessuno**, **Baffi**, **Basic**, **Trimmed**, con colori LPC. Il Re rimane `teen`; 36 definizioni di asset LPC adattate da `male` a `teen`, riutilizzando i PNG originali. È un adattamento grafico che richiede comunque una verifica visiva del posizionamento sull'avatar.
- Per `sesso === "F"` (**Genere Donna**) viene forzato `beardStyle = "none"`: generazione casuale (anche Nano), editor sul cambio genere e al salvataggio, migrazione dei vecchi salvataggi, rendering finale di mappa/ritratto. Non viene impedita barba agli Uomini.
- L'editor esclusivo dell'abito sacerdotale non rende accessibili Identità, Capelli, Baffi e barba, né Sorprendimi.

## Verifiche
- Regression test `tests/goblin-green-beard-gender-regression.test.ts`: Goblin su età/sessi/colori, sprite effettivamente renderizzabili, salvataggi legacy, livelli di barba teen e Donna senza barba per razze varie.
- Suite TypeScript e test npm verificati; web export da confermare nel relativo checkpoint.
- La QA visiva su dispositivo per il nuovo overlay baffi/barba teen resta da effettuare.

## Rilascio
La pubblicazione Vercel deve essere verificata su deployment READY associato al commit e sull'alias `kingdom-app-eight.vercel.app`. La mera riuscita GitHub non equivale a pubblicazione.
