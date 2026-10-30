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
