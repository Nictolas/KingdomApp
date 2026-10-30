# MyKingdom — Regno a territori (32×32)

## Scopo
Nuova modalità di mondo espandibile, destinata potenzialmente a diventare la
modalità principale. **Non** è un benchmark sui 200 abitanti e **non** è
un semplice aumento dei 5 settori 16×24 del prototipo precedente.

Il prototipo è isolato in tre moduli:
- `src/game/territoryWorldModel.ts`: generazione, biomi, edifici, confini,
  economia, cittadini, acquisto e conquista.
- `src/game/territoryWorldPersistence.ts`: salvataggio versione 1,
  validazione strutturale, serializzazione delle scritture.
- `src/ui/TerritoryWorldScreen.tsx`: viewport smartphone, camera,
  terreno/sprite originali, strumenti, mappa del regno.

## Regole concordate

1. Ogni territorio ha esattamente **32×32 = 1.024 caselle**.
2. I territori nuovi vengono determinati dal seed unico del mondo + coordinate
   globali; un territorio già scoperto resta identico quando viene rivisitato.
   Invece di salvare 1.024 tile per territorio, vengono salvate le **sole
   modifiche** (strade aggiunte, bosco eliminato) e gli edifici/abitanti.
3. Il regno può crescere oltre 5 territori. È implementato come piano cartesiano
   con coordinate negative e positive; la mappa 5×5 è solo una **finestra di
   navigazione**, non un confine geografico. La validazione attuale impone
   un massimo tecnico di 2.048 territori posseduti e coordinate ±4.096,
   da rivedere per regni estremamente grandi.
La finestra 5×5 della mappa generale può essere spostata verso nord,
sud, est e ovest **senza trasferire il giocatore** e senza consumare
risorse. Il pulsante centrale riporta la mappa al territorio attivo.
Sono visibili e selezionabili soltanto i territori già posseduti e
quelli confinanti acquistabili/conquistabili: gli altri restano coperti.
Lo spostamento della mappa è soltanto un'operazione visuale.

4. Acquisto e conquista sono entrambe interazioni giocabili. Costi, difese e
   forza militare sono **provvisori**: non costituiscono il sistema bellico
   definitivo.
5. Edifici collocabili su terreno libero, adiacente alle strade. Foreste
   richiedono disboscamento; acqua e roccia bloccano la costruzione. Le strade
   nuove devono collegarsi a quelle esistenti e si possono allungare.
6. La popolazione dipende dalle case; ogni cittadino ha una casella logica e
   uno sprite originale del prototipo. L'animazione è limitata ai personaggi
   renderizzati della porzione di territorio visibile; gli altri territori
   continuano a produrre e simulare movimento/nascite a ogni giorno.
7. Sul telefono si vede **una porzione ingrandita del territorio** (inizialmente
   12×12 delle 32×32 caselle), con movimento orizzontale/verticale e zoom
   8–16 caselle. Questa è una scelta UX temporanea, non una limitazione della
   mappa, da rivedere con l'utente.
8. Per evitare qualsiasi perdita di salvataggi, questa modalità usa solo
   `mykingdom:territories:v1`: NON legge/sovrascrive i salvataggi di Avventura,
   Creativa, del vecchio Regno a settori o dell'Editor abiti. Un file
   illeggibile resta intatto fino a un reset **esplicito**.

## Nuova geografia naturale (versione 2)

Per i mondi creati da questo aggiornamento è attivo il generatore
`src/game/territoryGeography.ts`:

- **Biomi regionali:** zone di pianura, bosco, collina, palude e terreno arido
  distribuite con campi climatici continui, non attraverso una scelta casuale
  indipendente per ogni riquadro.
- **Fiumi:** corsi d'acqua sinuosi calcolati su coordinate globali, che possono
  attraversare più territori senza interrompersi artificialmente al confine.
- **Catene montuose:** zone rocciose allungate, anch'esse continue fra territori.
- **Strade principali:** i quattro collegamenti ai bordi rimangono transitabili
  anche dove il fiume incontra la strada; per ora sono rappresentati come
  attraversamenti, mentre ponti e decorazioni specifiche saranno progettati
  dopo.
- **Mappa espansione:** colori distinti per il tipo di territorio, senza
  alterare i criteri di acquisto/conquista.

**Garanzia sui salvataggi:** lo schema di salvataggio resta
`mykingdom:territories:v1` per non sovrascrivere il vecchio archivio.
La nuova proprietà `terrainVersion: 2` è salvata soltanto nei nuovi mondi.
I salvataggi già esistenti senza questa proprietà continuano ad usare
il generatore originale (`terrainVersion: 1`); le modifiche alle strade,
agli edifici e al bosco non vengono rigenerate.

Il catalogo dei territori speciali/fissi **non è ancora definito**.

## Territori fissi: scelta ancora aperta

Il mondo contiene un registro `FIXED_TERRITORIES`, attualmente con il solo
`0,0` come **origine tecnica provvisoria** del regno. Non sono state
presunte localizzazioni permanenti di castello, Nord, Sud, Est, Ovest, risorse,
fiumi, miniere o insediamenti importanti. L'utente sceglierà in seguito
quali territori rendere fissi, senza dover abbandonare il seed o riprogettare
gli altri riquadri.

## Attività successive (non spacciate per completate)

- Catalogo di territori fissi scelto dall'utente e generazione più ricca
  (catene montuose, corsi d'acqua continui, laghi).
- Vera conquista militare con eserciti, combattimenti, diplomazia e rischio.
- Strade/fiumi/ponti come elementi connessi tra riquadri.
- Collegamento alle professioni e all'Editor abiti LPC.
- Trasferimenti di cittadini tra territori, trasporti, mercati e commercio.
- Ottimizzazione/memorizzazione e caricamenti incrementali per migliaia di territori.
- UX della camera su telefono, gestures di trascinamento e zoom a pizzico,
  sottoposta a prova utente.
- Eventuale sostituzione del gioco principale **solo dopo** approvazione
  esplicita e migrazione sicura dei salvataggi.

## Verifiche

`npx tsc --project tsconfig.territory-world.json --noEmit`

`npx tsx --test tests/territory-world.test.ts tests/territory-world-persistence.test.ts`

`npm run build:web`

Il workflow `Expandable Territory World` verifica anche gioco reale in
Chromium su viewport da 390×844 e 320×568, screenshot, acquisto, costruzione,
passaggio del giorno, uscita e riapertura della partita.
