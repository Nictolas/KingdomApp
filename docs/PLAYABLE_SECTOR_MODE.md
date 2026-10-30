# Regno a settori — modalità giocabile sperimentale

PR Draft #300, branch `feat/playable-sector-mode-20261030`. Il prototipo a settori fissi della PR #299 rimane separato. La modalità giocabile è selezionabile dalla schermata iniziale, accanto ad Avventura e Creativa.

## Funzioni e confini
- Cinque settori 16×24, 110 residenti complessivi (30 nel Centro), movimento e produzione in tutti i settori; rendering solo del settore attivo.
- Casa, Fattoria e Bottega costruibili su impronte libere 2×2, demolizione solo degli edifici creati dal giocatore; produzione, consumo e orologio a giorni.
- Su schermi piccoli il comando **Posiziona** trova automaticamente la prima area 2×2 libera nel settore attivo; usa le stesse verifiche di risorse/occupazione del tocco e non modifica altre zone. Se non c’è spazio, non scala il costo né cancella nulla.
- Salvataggio AsyncStorage **esclusivamente** nella chiave `mykingdom:sectors:playable:v1`. La modalità non cancella né legge la partita principale.
- Scritture serializzate: l'ultima versione non può essere sovrascritta da una scrittura precedente lenta. Uscita attende la scrittura corrente e riprova in caso di errore.
- Salvataggi illeggibili o non validi non vengono sovrascritti automaticamente: l'utente deve scegliere esplicitamente Ricomincia. Il reset ha conferma e riguarda solo questa modalità.
- La validazione del salvataggio controlla risorse, coordinate, energia, identità, collisioni, limiti dimensionali e versione prima di entrare nel rendering.

## Grafica originale della modalità a settori (30 ottobre)
- Terreno e strade: `TerrainSheetSprite` e coordinate reali `getErbaSheetCoord` / `getStradaSheetCoord` dal foglio originale `spritesheet-full.png`, anziché rettangoli a tinta unita.
- Abitanti: ritagli dal file originale `character.png`, non sagome geometriche. I 30 abitanti del Centro sono visibili quando il Centro è attivo; i restanti settori sono simulati ma non montati nell'interfaccia.
- Castello, case e alberi usano gli asset esistenti. In questa fase Fattoria e Bottega condividono le varianti di case/capanne già presenti: le loro illustrazioni specifiche richiedono successiva scelta di asset verificati.
- Le 384 coordinate del terreno sono pre-calcolate e il livello statico è memoizzato: lo scorrere dei giorni aggiorna gli sprite degli abitanti senza ricostruire l'intera mappa di base. Nessuna variazione al formato dei salvataggi.
- Un solo timer condiviso (280 ms) anima i tre fotogrammi originali per gruppo direzionale degli abitanti **solo nel settore visibile**; durante la pausa si ferma. La simulazione degli altri settori e la persistenza non usano questo timer grafico.
- Il test Chromium verifica **immagini scaricate e decodificate**, 384 celle con immagini originali, 30 residenti visibili al Centro, 22 al Sud, costruzione, viaggio, giorno e persistenza. Produce screenshot a due dimensioni smartphone, caricati come artifact del workflow.

## Correzione asset e topologia delle strade — revisione su screenshot CI
- Uno screenshot del browser 390×844 del precedente commit ha mostrato un errore effettivo: la selezione `verticale` dell'atlante rimandava al tile metallico [64,768], creando una griglia grigia sulle strade. La mappa non era graficamente definitiva anche se le immagini risultavano caricate.
- Ora `sectorPlayableTerrain.ts` usa i 9 pezzi del blocco in terra [512,128]–[704,320] con bordi/corner corretti, basati sui vicini strada/erba; preserva le 16×24 caselle e la topologia originale. Meno ripetizioni dell'ornamento grande sull'erba.
- Le fattorie espongono un crop originale dell'atlante e le botteghe una cassa originale come dettagli sulle immagini delle case. A Nord si alternano `tree_1.png` e `tree_2.png`, entrambi già presenti nel repository.
- Nuova suite `sector-playable-terrain.test.ts`: tutte le 384 celle dentro la texture, coordinate a multipli di 64, bordi e incrocio della strada, icone di fattoria/bottega e input invalidi.
- Chromium verifica anche le immagini di fattorie e botteghe nei rispettivi settori, l'animazione tramite `getComputedStyle` (React Native Web può codificare `left` in classi CSS) e la pausa. **Nuova CI da verificare sul commit conclusivo** prima di dire che il bug è risolto nell'esportazione.

## Interazione accessibile con caselle piccole
- Il vecchio flusso richiedeva un tocco quasi pixel-perfect su caselle da pochi punti. `buildAtAvailableSpot` fornisce un'alternativa deterministica, controllata con test per assenza di fondi, settore totalmente occupato, immodificabilità degli altri settori e salvataggio valido.
- E2E smartphone: seleziona una Fattoria, usa **Posiziona**, verifica che l'icona vegetale compaia, esci dalla modalità e controlla che la costruzione rimanga dopo il rientro.
- Non aggiunge scorrimento, zoom o un nuovo formato di salvataggio.

## Verifiche automatizzate
Il workflow `Playable Sector Mode` esegue typecheck isolato, test del modello e della persistenza, esportazione web e Chromium su due viewport smartphone. Controlla selezione dal menu, avanzamento giorno, viaggio, costruzione, conferma reset e ripresa del salvataggio. I risultati si riferiscono al commit e alla pipeline specifici: **non** equivalgono a test fisici.

## Rischi e prove mancanti
- Verificare l'esito finale della CI **sull'ultimo commit** e ispezionare gli artifact screenshot; test verdi su commit precedenti non bastano a certificare questa integrazione.
- Gli abitanti animano i fotogrammi originali, ma non hanno ancora la pipeline LPC completa della partita principale (abiti/personalizzazione, direzione dedotta dagli spostamenti e movimento continuo).
- Controllo della leggibilità del livello 16×24 su schermi fisici piccoli, contrasto e selezione delle celle; la prova browser emula la viewport e non sostituisce il touchscreen.

- Prova reale su Android/iPhone (touch, safe area, leggibilità 16×24, orientamento, persistenza tra chiusure forzate).
- Test reale di concorrenza tra due schede browser; la coda serializza solo le scritture della singola schermata.
- Validazione della preview Vercel protetta SSO e accesso utente; `READY` indica che il deployment è pronto, non che il gioco sia stato giocato su quel deployment.
- Non è la simulazione completa della modalità Avventura/Creativa. Non è stata misurata la fluidità nativa di 200 residenti.
- Nessun merge, deploy di produzione o alterazione di `main` è autorizzato da questa PR.
