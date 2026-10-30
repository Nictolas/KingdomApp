# Regno a settori — modalità giocabile sperimentale

PR Draft #300, branch `feat/playable-sector-mode-20261030`. Il prototipo a settori fissi della PR #299 rimane separato. La modalità giocabile è selezionabile dalla schermata iniziale, accanto ad Avventura e Creativa.

## Funzioni e confini
- Cinque settori 16×24, 110 residenti complessivi (30 nel Centro), movimento e produzione in tutti i settori; rendering solo del settore attivo.
- Casa, Fattoria e Bottega costruibili su impronte libere 2×2, demolizione solo degli edifici creati dal giocatore; produzione, consumo e orologio a giorni.
- Salvataggio AsyncStorage **esclusivamente** nella chiave `mykingdom:sectors:playable:v1`. La modalità non cancella né legge la partita principale.
- Scritture serializzate: l'ultima versione non può essere sovrascritta da una scrittura precedente lenta. Uscita attende la scrittura corrente e riprova in caso di errore.
- Salvataggi illeggibili o non validi non vengono sovrascritti automaticamente: l'utente deve scegliere esplicitamente Ricomincia. Il reset ha conferma e riguarda solo questa modalità.
- La validazione del salvataggio controlla risorse, coordinate, energia, identità, collisioni, limiti dimensionali e versione prima di entrare nel rendering.

## Verifiche automatizzate
Il workflow `Playable Sector Mode` esegue typecheck isolato, test del modello e della persistenza, esportazione web e Chromium su due viewport smartphone. Controlla selezione dal menu, avanzamento giorno, viaggio, costruzione, conferma reset e ripresa del salvataggio. I risultati si riferiscono al commit e alla pipeline specifici: **non** equivalgono a test fisici.

## Rischi e prove mancanti
- Prova reale su Android/iPhone (touch, safe area, leggibilità 16×24, orientamento, persistenza tra chiusure forzate).
- Test reale di concorrenza tra due schede browser; la coda serializza solo le scritture della singola schermata.
- Validazione della preview Vercel protetta SSO e accesso utente; `READY` indica che il deployment è pronto, non che il gioco sia stato giocato su quel deployment.
- Non è la simulazione completa della modalità Avventura/Creativa. Non è stata misurata la fluidità nativa di 200 residenti.
- Nessun merge, deploy di produzione o alterazione di `main` è autorizzato da questa PR.
