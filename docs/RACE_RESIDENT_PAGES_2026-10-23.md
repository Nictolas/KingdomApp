# My Kingdom — Navigazione Razze → Abitanti

23 ottobre 2026, PR per le pagine dedicate alle razze.

## Funzionalità
La pagina `/razze` presenta le sette razze come schede selezionabili. Premendo una scheda si apre:
- `/razze/umani` (Umano)
- `/razze/elfi` (Elfo)
- `/razze/nani` (Nano)
- `/razze/orchi` (Orco)
- `/razze/goblin` (Goblin)
- `/razze/felix` (Felix)
- `/razze/golem` (Golem)

Ogni pagina mostra gli abitanti reali della partita, filtrati per razza e ordinati per nome, su sfondo blu. Le schede nella griglia mostrano lo sprite della persona e sotto il suo nome, con colonne responsivi: 2 su telefono stretto, 3–4 su tablet, 6 su desktop. I Golem hanno il proprio simbolo. Le razze senza abitanti presentano un messaggio vuoto appropriato. Un pulsante persistente permette di tornare a tutte le razze.

## Architettura
- Mapping centralizzato slugs/razze in `src/game/razzeNavigazione.ts`, senza nuovi dati persistiti.
- Griglia principale cliccabile in `app/razze.tsx`.
- Rotta dinamica Expo Router in `app/razze/[razza].tsx`, con gestione di slug inesistente.
- Il rendering riusa `AbitanteAvatarPreview` e le regole LPC reali della popolazione.
- La configurazione Vercel (`vercel.json`) include rewrite SPA `/(.*) -> /index.html`: consente di aprire o ricaricare un indirizzo diretto come `/razze/nani`. I file statici mantengono precedenza sul rewrite.

## Test
`tests/race-residents-navigation.test.ts` verifica unicità e mapping degli slug, filtro per razza, ordinamento e aggiornamento residenti, UI/navigazione e regola Vercel. Ulteriori controlli: suite completa, typecheck, export web, GitHub Actions e Vercel READY sul commit corretto.

## QA manuale
Aprire `/razze` sul sito di produzione, selezionare Nani, confermare nome e sprite per ogni abitante; aprire Felix, una razza senza abitanti, tornare a Razze; provare copia-incolla o ricarica dell'URL diretto `/razze/nani`; verificare 2 colonne su mobile.
