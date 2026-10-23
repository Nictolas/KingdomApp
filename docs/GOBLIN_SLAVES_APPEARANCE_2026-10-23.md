# MyKingdom — Pelle verde Goblin e uniforme Schiavi

Data: 23 ottobre 2026

> **Documento storico (PR #269).** La vecchia divisa con `skirts_slit` è stata sostituita: dal 23 ottobre 2026 l'unico indumento della casta Schiavo è **Short Shorts (Walnut)**. Consultare `docs/SLAVE_SHORT_SHORTS_WALNUT_2026-10-23.md` per la regola attuale.

## Regole
- Tutti i Goblin hanno pelle verde `orc_green`, coerente con la palette già adottata dagli Orchi. Si applica nel generatore, nell'editor, nel renderer LPC e nei salvataggi precedenti.
- La testa Goblin usa il layer LPC `goblin` nella variante verde `olive`; il corpo riutilizza i 12 sheet `orc_green`, senza mutare gli altri popoli.
- Sono aggiunte le varianti di testa Goblin per corpi `child`, `pregnant` e `muscular` riutilizzando gli asset originali, con attribuzione originale preservata.
- Gli abitanti la cui casta effettiva è `Schiavo` mostrano sempre capelli e barba `none`, nessun capo superiore, maniche, vestito integrale, calzature, mantello, maschera o accessorio, e soltanto `lowerOutfit = "skirts_slit"` in colore marrone.
- Il catalogo LPC contiene `skirts_slit` soltanto per corpo teen: gli stessi asset sono adattati come layer per i tipi `child`, `male`, `female`, `muscular` e `pregnant`. Il gioco mantiene il corpo corretto senza imporre la corporatura adolescente.
- Le regole degli Schiavi si applicano alla visualizzazione (mappa, anteprima e scheda), non sovrascrivono il guardaroba persistito: quando vengono liberati, riappare l'aspetto personale. Le regole prevalgono anche su divise professionali, abbigliamento pubblico e nudismo.
- Altri abitanti non cambiano abiti; Orchi conservano gli sprite verdi precedenti.

## Percorsi
- `src/character-system/appearance.ts`: colore obbligatorio per i Goblin, inclusa la gravidanza.
- `src/character-system/registry.ts`: colore della pelle nell'editor; testa Goblin su corpo verde.
- `src/character-system/generated/lpc-manifest.json`: varianti di testa Goblin e adattatori LPC della gonna.
- `src/game/personaggioAspetto.ts`: generazione/normalizzazione Goblin e uniforme di presentazione per gli Schiavi.
- `src/persistence/saveValidation.ts`: migrazione Goblin dai salvataggi precedenti.
- `src/ui/CreazioneGiocatoreModal.tsx`: niente selezione di pelle umana per Goblin.
- `tests/goblin-slaves-appearance.test.ts`: regressioni di skin tone, sprite idle/walk, visualizzazione Schiavi e liberazione.

## Quality gate
I test automatici e la build web devono risultare verdi prima della pubblicazione. Il QA visivo su telefono deve ancora confermare l'allineamento geometrico delle varianti di gonna e testa adattate, inclusi Schiavi di tutte le corporature.
