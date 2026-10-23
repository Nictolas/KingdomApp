# My Kingdom — Schiavi: Short Shorts (Walnut)

**Data decisione:** 23 ottobre 2026. **Sostituisce** l'indumento "Skirts: Skirt Slit" della PR #269; la versione precedente resta conservata come documentazione storica.

## Regola definitiva

Tutti gli abitanti di casta `Schiavo`, senza distinzione di genere, razza, mansione o età, sono rappresentati con:
- capelli `none`, barba/baffi `none`;
- **un solo indumento:** `Short Shorts (Walnut)` del catalogo Universal LPC;
- LPC `lowerOutfit: "short_shorts"`, `outfitSecondaryColor: "walnut"`;
- nessuna maglia, altra gonna, altro pantalone, divisa da Guardia, scarpa, calza, copricapo, mantello, maschera o accessorio.

La regola è applicata come *overlay di visualizzazione*, attraverso `aspettoSchiavo` e `aspettoPerVisualizzazioneAbitante`. Non modifica l'abbigliamento personale persistito; quando una persona non è più Schiava, torna a indossare i propri abiti precedenti.

## Asset e attribuzioni

Il pack locale iniziale **non conteneva** "Short Shorts". Si importano le vere texture Universal LPC del file `legs/shorts/legs_shorts_short.json`, non sprite rinominati. Definizione upstream fissata al commit `9bf06be193b053db256b2536824af426de046aa2` di `LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator`. Colore `walnut` prodotto usando la palette `cloth/cloth_ulpc.json`, con base `white`.

Quattro PNG: maschile e sottile, entrambi `idle` e `walk`; nel manifest si utilizzano per `male`, `female`, `teen`, `child`, `muscular` e `pregnant`. Sorgenti in `assets/character-packs/lpc/generated/`; layer a zPos 20 e semanticId `short_shorts`.

La licenza e gli autori originali sono registrati sotto attributionId `b173cea57472` in `src/character-system/generated/lpc-credits.json` (crediti OGA-BY 3.0, e GPL 3.0 per la variante maschile, secondo la definizione originale). Lo script riproducibile è `scripts/import_short_shorts_walnut.py`.

## Verifiche e checklist

- Test regressione della divisa `tests/slave-short-shorts-walnut.test.ts`.
- Test preesistente aggiornato `tests/goblin-slaves-appearance.test.ts`.
- Verifica della texture corretta e del colore `walnut` per 6 corporature e `idle`/`walk`.
- Verifica che non siano renderizzati altri livelli vestiti; nessuna distruzione del guardaroba persistito.
- Verifica della suite generale, typecheck, CI GitHub, release Vercel.
- **QA manuale residua:** controllo visivo dei pantaloncini e dell'allineamento sulle corporature, specialmente bambini, in una partita reale su mobile.
