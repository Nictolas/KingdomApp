# MyKingdom — diagnosi strutturale degli avatar e dei Nani (24 ottobre 2026)

## Base e riproduzione
La correzione parte dal commit pubblicato `5634ef448a3ff7b9c2630c445d735afb0bad82b4`, non dal branch principale né dalle PR in bozza per Bosco e P2P.

1. La card `app/razze.tsx` passava l'aspetto casuale a `CircularSpriteFrame` senza prima verificare se `resolveCharacterLayers` restituisse strati. L'anteprima del Nano (seed 126) generava 0 strati ed era visivamente vuota.
2. In `src/character-system/appearance.ts`, `dwarfChildOutfit` impone `child_shirt`, `child_pants` o `child_skirt`. Il manifest distribuito **non conteneva nessuna maglia per il corpo `child`** e non includeva nessuno dei tre ID. `aspettoRenderizzabileAbitante` cercava di recuperare eliminando i capi incompatibili: il Nano tornava visibile ma nudo.
3. I sei ritratti statici di razza (escluso il Golem) condividevano il renderer a molti file, quindi anche i loro molteplici caricamenti e fallback mancanti. Nell'esempio analizzato, l'anteprima del Nano aveva 0 strati; le altre cinque ne avevano 7, 8, 9, 7, 12. In caso di fallimento rete o asset, `Image` poteva lasciare vuoto il cerchio senza informare l'utente.
4. Il problema risulta riproducibile già prima del rilascio con un manifest contenente **0 outfit superiori child** e con un test parametrico di 150 Nani generati: 150/150 senza maglia e senza pantaloni grafici. Le altre razze hanno superato lo stesso controllo campione, quindi per i loro cerchi vuoti la spiegazione più probabile è un fallimento di caricamento/rendering del compositing, non una razza assente.

## Correzioni
- `scripts/build_child_clothes_from_lpc.py` genera 58 varianti PNG LPC compatibili con il corpo `child`, 64×64 per frame, 4 direzioni, idle/walk, da sprite teen/child già versionati nel repository. Il colore/shading restano riconoscibili; le trasformazioni mantengono la pixel-art (nearest-neighbor). Genera tre capi `child_shirt`, `child_pants`, `child_skirt` con colori diversi, aggiorna manifest e `lpcAssetSources.ts` con `require` statici. Gli ID attribuzione originali restano preservati.
- `scripts/preview-layers-diagnostic.ts` e `scripts/build_race_portraits.py` compongono un singolo ritratto PNG per ciascuna delle sei razze renderizzabili, usando gli asset LPC reali in corretto ordine Z. Il Golem conserva l'emoji.
- `src/ui/RacePortrait.tsx` carica soltanto un PNG per scheda razza e mantiene un simbolo di riserva fino a caricamento completato o dopo errore.
- `src/ui/CircularSpriteFrame.tsx` e `src/components/SpriteCharacterRenderer.tsx` introducono un fallback della razza nei cerchi se mancano i layer necessari o se un PNG fallisce il caricamento, anziché lasciare uno spazio vuoto.
- Nessuna trasformazione dei dati salvati, nessuna modifica alla simulazione, professioni, Bosco, P2P, o navigazione di gioco.
- La regola di abbigliamento dei personaggi con casta Schiavo resta separata e invariata, come da regole già fissate.

## QA richiesti prima del rilascio
- Typecheck completo e suite automatica.
- Build/export web.
- Verifica visuale della griglia Razze, della galleria dei residenti e dei Nani maschi/femmine sul browser mobile con una partita nuova e salvataggi esistenti. Il computer non dispone dei dati locali privati dell'utente presenti nell'iPhone.
- Solo dopo, scegliere come integrare la patch nel ramo attualmente pubblicato senza trascinare dentro le PR draft su P2P/Bosco.
