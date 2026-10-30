# MyKingdom — campione di mappa a settori fissi (30/10/2026)

## Obiettivo e stato
Esperimento **isolato** sulla route `/settori-preview` di Expo Router, su branch dedicato.
Non sostituisce `/mappa`, non legge/scrive `GameContext`, non cambia salvataggi, algoritmi di movimento o costruzioni. Non è pronto per la pubblicazione.

La scelta di design da provare: il giocatore vede **un solo settore per volta**, l'intero settore entra nello spazio grafico disponibile, **nessuno scroll, pan o pinch-to-zoom**, passaggio con quattro frecce e minimappa.

## Fixture
- Centro città, Nord/Bosco, Sud/Fattorie, Est/Mercato, Ovest/Quartiere.
- Griglia visibile sempre **16×24 caselle quadrate**; 14×21 è soltanto una variante di test del modello, senza pulsante nell'interfaccia.
- **Centro:** 15 case 3×3, un castello 5×5, 30 residenti (ID unici).
- Complessivamente 110 residenti dimostrativi nei cinque settori, deterministici.
- Occupazione edifici mutuamente esclusiva e fuori dalle strade, residenti in celle libere.
- Unicamente il settore attivo genera componenti React per le celle, gli edifici, gli alberi e i residenti. L'altro settore mantiene solo dati semplici in memoria.
- I PNG delle case, degli alberi e del castello sono asset già presenti nel repository; non vengono aggiunte nuove dipendenze.

## Aprire la prova
1. Checkout branch `feat/fixed-sector-preview-20261030`, `npm install`.
2. `npm run start`, avvia Expo sul dispositivo o in un browser.
3. Apri `/settori-preview` tramite routing Expo (o URL locale `http://localhost:8081/settori-preview` su web).
4. Prova quattro frecce, minimappa, selezione edifici/personaggi e i due pulsanti ‹ › per scorrere ogni elemento anche quando le caselle sono minuscole. La griglia resta 16×24.
5. Controlla in particolare su telefoni piccoli che il footer resti visibile e i quadrati non si deformino.

## Validazione
- `npx tsx --test tests/sector-preview.test.ts`: topologia, 16×24, 15 case + castello, 30 residenti al centro, 110 in tutto, nessuna sovrapposizione, determinismo, layout 14×21.
- `npm run typecheck` (attenzione: il repository può avere errori TypeScript preesistenti; confrontare con main, non inferire il risultato da una sola esecuzione).
- `npm run build:web` e le pipeline CI eventualmente presenti.
- **Manca** la verifica fisica di dimensione tocchi, leggibilità degli sprite, performance e memoria su Android/iPhone. Non dedurre FPS da questi test.

## Limite architetturale importante
Il preview è uno **studio di layout e interazione**, non è ancora una migrazione del mondo del gioco. La simulazione degli abitanti nei settori nascosti richiede un passo separato:
1. dare a ogni residente una posizione globale `(sectorId, cell)`;
2. separare movimento/azioni in simulazione dalla loro rappresentazione grafica;
3. creare transizioni atomiche ai bordi del settore senza teletrasporti o duplicati;
4. preservare IA, lavori, percorsi, edifici, salvataggi e compatibilità;
5. testare con 25/50/100/200 residenti reali e dispositivi fisici.

La regola di sicurezza è che l'esperimento resta **Draft** finché questo percorso non è validato.


## Rafforzamento layout e interazione
- Il campione operativo mantiene **solo 16×24**: il precedente pulsante 14×21 è stato tolto perché il requisito è una griglia fissa. La funzione di modello può ancora generare 14×21 per i test di confronto, ma non è esposta nella schermata.
- Rimosso il comando «Pausa»: la fixture non simula il tempo, quindi quel pulsante era fuorviante.
- Layout ridotto per schermi stretti o bassi (intestazione/footer); griglia con celle sempre quadrate, dimensionate allo spazio realmente disponibile dentro la safe area.
- Frecce con area nominale 44×44 punti; la minimappa permette anche la navigazione diretta. Sono necessari test tattili fisici per confermare la fruibilità.
- Selezione di edifici/abitanti tramite celle esatte e recupero del tocco vicino agli abitanti nelle caselle vuote, senza pan/zoom; i singoli elementi restano accessibili anche come pulsanti.
- Test puri aggiunti per hit-test, geometria in sei viewport e 750 selezioni ripetute su cinque settori. Non equivalgono a test UI su device.

## Risultato CI da tenere distinto
La CI generale del repository segnala errori TypeScript in file preesistenti non appartenenti al prototipo (es. `app/castello.tsx`, `src/game/cuginoNobileAvventura.ts`, test legacy). Il controllo dedicato `Fixed Sector Preview` esegue un **typecheck TypeScript isolato** (solo route, modello e test del prototipo), test del modello ed export JavaScript web/Android/iOS. Non dimostra un typecheck globale pulito. Non correggere file di produzione dentro questa PR sperimentale.

## Matrice manuale da eseguire (non ancora verificata fisicamente)
- Android piccolo ~320×568, Android grande ~412×915, iPhone con notch e iPhone compatto.
- Per ogni device: tutti e cinque i settori, frecce e minimappa, 30 residenti al Centro, edifici selezionabili, assenza pan/zoom, rotazione se supportata, safe area e pulsanti non coperti.
- Rilevare larghezza della casella e leggibilità effettiva degli sprite; se troppo piccoli, il requisito «tutto il settore visibile» va rivalutato con dati misurati.

Il typecheck isolato si esegue con `npx tsc --project tsconfig.sector-preview.json --noEmit`; verifica anche gli import transitivi, senza includere i file legacy non collegati alla route.

## Selezione accessibile e adattamento orizzontale (30 ottobre)
- I due pulsanti ‹ › nel footer hanno un'area di pressione nominale **44×44 punti**: scorrono ciclicamente tutti gli edifici e abitanti del settore attivo, senza richiedere tocchi precisi su sprite di pochi pixel. La selezione viene azzerata al cambio settore.
- La griglia espone azioni di accessibilità «Elemento successivo» e «Elemento precedente» per i lettori di schermo. Edifici, abitanti e settori della minimappa dichiarano lo stato selezionato; gli alberi decorativi non intercettano più i tocchi.
- In orientamento orizzontale l'intestazione e il footer sono ridotti, la minimappa usa celle più compatte e il disclaimer è nascosto per preservare spazio. **La griglia non viene deformata né abilitata al pan/zoom.**
- Se la casella calcolata scende sotto 12 punti, il footer consiglia i controlli ‹ ›. Questo è un avviso, non la prova che la grafica sia leggibile: su schermi orizzontali molto bassi il vincolo 16×24 potrebbe rendere gli sprite inutilizzabili.
- I test del modello verificano copertura completa di ogni settore in entrambi i versi, wrap-around, selezioni obsolete, settori vuoti e hit-test a caselle di 1–18 punti. Non sono test di UI renderizzata, né dimostrano comportamento di VoiceOver/TalkBack o touch fisici.

### Matrice manuale aggiuntiva
Per Android e iPhone reali, in verticale e orizzontale: selezionare il primo/ultimo elemento e verificare il ciclo completo con ‹ ›; attivare TalkBack/VoiceOver e provare incrementa/decrementa sulla griglia; verificare tap sugli alberi, pulsanti non coperti dalla safe area, testo ingrandito e selezione dopo il cambio settore. Registrare screenshot con dimensioni schermo, safe area, larghezza effettiva delle celle e anomalie. La sola CI non sostituisce questa verifica.

### CI verificata prima di questo intervento
Sul commit `01808ed95e74ce2506331f9e9ef754015d08bd32` il workflow [Fixed Sector Preview #40985127968](https://github.com/Nictolas/KingdomApp/actions/runs/40985127968) è **verde**: typecheck isolato, test del modello, export JS web/Android/iOS. Il workflow generale [CI #40985127834](https://github.com/Nictolas/KingdomApp/actions/runs/40985127834) fallisce al typecheck globale, senza eseguire i passi successivi. Questi risultati **non** si applicano automaticamente al commit nuovo; verificare nuovamente il workflow dedicato. Gli export sono bundle JavaScript, non build native installate su telefono.

## Verifica CI e audit adattivo del 30 ottobre (iterazione successiva)
- Il commit `9cc38ab584ea8b584b1c6c885c999c10504ae90a` ha completato con successo il workflow dedicato [#40990327462](https://github.com/Nictolas/KingdomApp/actions/runs/40990327462): TypeScript isolato, test modello ed export JavaScript web/Android/iOS. **Non sono build native installabili né test su telefono.**
- La CI generale [#40990327434](https://github.com/Nictolas/KingdomApp/actions/runs/40990327434) è fallita al typecheck globale; test e build globali non sono partiti. Non attribuire automaticamente il fallimento al preview senza confronto con main.
- Questa iterazione misura il **contenitore mappa effettivo dopo la safe area**, senza assumere dimensioni schermo ideali, e classifica la dimensione della casella: meno di 10 punti = troppo piccola; 10–13 = compatta; almeno 14 = leggibilità da verificare fisicamente. Le soglie sono indicazioni, non standard certificati.
- In orientamento orizzontale con caselle minuscole l'interfaccia consiglia i comandi di selezione e l'orientamento verticale. Non modifica la griglia 16×24, non attiva pan/zoom e non nasconde oggetti.
- Il recupero del tocco vicino a un abitante è ora limitato a **1,5 caselle**, oltre al massimo precedente di 22 punti, per evitare di selezionare un personaggio distante quando le caselle diventano molto piccole.
- Il footer mostra settore, coordinate della casella e indice dell'elemento selezionato nell'elenco accessibile; il cambio settore azzera la selezione. Le frecce laterali sono centrate verticalmente.
- Test aggiunti per dimensioni del contenitore, selezione completa in tutti i settori, ID non più validi e tocchi a caselle di 4 punti. **Sono test del modello e delle regole di layout, non screenshot renderizzati, test di accessibilità reale o prove fisiche.**
- Dopo il nuovo commit verificare di nuovo la CI dedicata; la riuscita precedente non è trasferibile automaticamente.


## 30 ottobre — frecce senza occlusione e safe area laterale
- **Problema individuato nell'audit del layout:** le quattro frecce da 44 punti erano posizionate sopra la griglia; su smartphone compatti potevano coprire caselle, abitanti ed edifici. Inoltre il `SafeAreaView` proteggeva soltanto alto e basso, non i bordi laterali del notch in orizzontale.
- **Correzione isolata:** quattro frecce in una barra separata di **52 punti**, sotto la mappa; la griglia rimane 16×24, quadrata, interamente sopra i comandi, senza pan/zoom. Il contenitore include ora i quattro bordi della safe area. La minimappa continua a permettere l'accesso diretto a tutti e cinque i settori.
- Il calcolo puro `measureSectorPreviewNavigationLayout` usa lo spazio **effettivo** del contenitore mappa, sottrae la barra di navigazione e restituisce margini e possibilità di disporre quattro pulsanti da 44 punti. La UI mostra la dimensione calcolata della casella in punti, utile nelle fotografie di verifica.
- Test aggiunti per sei viewport, inclusa una schermata orizzontale bassa, margini e non sovrapposizione geometrica, oltre a un controllo statico della route per quattro bordi safe-area e assenza di pan/zoom. Questi test **non verificano il rendering React Native reale**, l'orientamento consentito dall'OS, la leggibilità o il touch fisico.
- **Compromesso misurabile:** riservare 52 punti alle frecce può ridurre la dimensione delle caselle rispetto alla precedente sovrapposizione. In orizzontale la mappa può diventare molto piccola: non dichiarare il campione definitivo finché screenshot e prova su Android/iPhone non confermano leggibilità e fruibilità. Se necessario, la decisione progettuale richiederà una revisione esplicita, non un cambio nascosto della griglia.
- Stato prima di questa modifica: [workflow dedicato #40996264485](https://github.com/Nictolas/KingdomApp/actions/runs/40996264485) **verde** su `12497f01`, inclusi typecheck isolato, test modello ed export JS web/Android/iOS. [CI generale #40996264553](https://github.com/Nictolas/KingdomApp/actions/runs/40996264553) **rossa** sul typecheck globale. Verificare una nuova CI per questa modifica; i bundle JS non sono APK/IPA né misure su dispositivi.

## 30 ottobre — validazione UI renderizzata in browser (non device)
- Nuovo job CI indipendente `browser-rendered-preview`: esporta il bundle web, avvia un server **locale al runner** e usa Chromium headless tramite Playwright installato soltanto nel job (nessuna dipendenza dell'app).
- Il test apre davvero `/settori-preview` in sette viewport (320×568, 375×667, 390×844, 430×932, 667×375, 844×390, 1024×768), seleziona il castello, visita tutti i settori con la minimappa e controlla rettangoli DOM: caselle quadrate, griglia visibile, frecce fuori dalla griglia, footer non tagliato. Salva screenshot come artifact del workflow anche in caso di errore.
- Gli elementi UI hanno `testID` stabili per l'ispezione automatica; rimossa la zona di tocco extra di 3 punti dei residenti, che sulle celle piccole poteva intercettare la cella adiacente prima del controllo esatto. La selezione di prossimità rimane nella griglia sottostante, soltanto sulle celle vuote.
- **Stato al momento della modifica: da verificare nella CI del nuovo commit.** La CI dedicata del commit precedente `ccf7883a` [#41001953003](https://github.com/Nictolas/KingdomApp/actions/runs/41001953003) è interamente verde (typecheck isolato, test del modello, export JS web/Android/iOS); la [CI generale #41001952874](https://github.com/Nictolas/KingdomApp/actions/runs/41001952874) fallisce al typecheck globale legacy.
- **Limiti:** Chromium web non riproduce il renderer nativo, notch reali, gesture hardware, VoiceOver/TalkBack, densità fisica dei pixel, GPU o FPS Android/iOS. Screenshot CI **non sono** prova su telefono. Il layout resta da approvare manualmente su Android e iPhone fisici prima di definire il campione definitivo. La root Expo monta ancora il `GameProvider` globale, anche se questa route non legge né scrive direttamente il contesto: la prova non è un isolamento dell'intera applicazione.


## 30 ottobre — diagnosi della CI visuale e rafforzamento del controllo browser
- **Esito verificato del commit `d871f541`:** il job `preview-validation` è verde, compresi TypeScript isolato, test modello ed export JavaScript web/Android/iOS; il job `browser-rendered-preview` è **rosso prima dell'avvio dei test**. Il runner `ubuntu-latest` era Ubuntu 26.04, non supportato da Playwright 1.55.0 (`ERROR: Playwright does not support chromium on ubuntu26.04-x64`). Non esistono screenshot di quel run e non è un errore della UI. [Run #41007426569](https://github.com/Nictolas/KingdomApp/actions/runs/41007426569).
- **Correzione mirata:** solo il job browser usa il runner esplicito `ubuntu-24.04`, compatibile con Playwright 1.55.0. Non cambiano dipendenze di produzione, route o fixture.
- **Copertura estesa:** oltre a sette viewport, controlli su assenza di scroll della pagina, separazione mappa/frecce/footer, target di navigazione e selezione da almeno 44 punti nominali, comportamento delle frecce Nord/Sud al confine, navigazione minimappa in tutti e cinque i settori e screenshot di ogni settore per ogni viewport. I controlli possono individuare difetti reali di layout; **non vanno dichiarati superati finché il nuovo workflow non è verde**.
- La prova rimane web Chromium in CI, **non** un test su Android/iPhone fisici, safe area/notch reale, VoiceOver/TalkBack, tocchi o FPS nativi. Nessun merge/deploy.
