# MyKingdom — campione di mappa a settori fissi (30/10/2026)

## Obiettivo e stato
Esperimento **isolato** sulla route `/settori-preview` di Expo Router, su branch dedicato.
Non sostituisce `/mappa`, non legge/scrive `GameContext`, non cambia salvataggi, algoritmi di movimento o costruzioni. Non è pronto per la pubblicazione.

La scelta di design da provare: il giocatore vede **un solo settore per volta**, l'intero settore entra nello spazio grafico disponibile, **nessuno scroll, pan o pinch-to-zoom**, passaggio con quattro frecce e minimappa.

## Fixture
- Centro città, Nord/Bosco, Sud/Fattorie, Est/Mercato, Ovest/Quartiere.
- Griglia di default 16×24 caselle quadrate; bottone di confronto 14×21.
- **Centro:** 15 case 3×3, un castello 5×5, 30 residenti (ID unici).
- Complessivamente 110 residenti dimostrativi nei cinque settori, deterministici.
- Occupazione edifici mutuamente esclusiva e fuori dalle strade, residenti in celle libere.
- Unicamente il settore attivo genera componenti React per le celle, gli edifici, gli alberi e i residenti. L'altro settore mantiene solo dati semplici in memoria.
- I PNG delle case, degli alberi e del castello sono asset già presenti nel repository; non vengono aggiunte nuove dipendenze.

## Aprire la prova
1. Checkout branch `feat/fixed-sector-preview-20261030`, `npm install`.
2. `npm run start`, avvia Expo sul dispositivo o in un browser.
3. Apri `/settori-preview` tramite routing Expo (o URL locale `http://localhost:8081/settori-preview` su web).
4. Prova quattro frecce, minimappa, selezione edifici/personaggi e passaggio 16×24 / 14×21.
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
