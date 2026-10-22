# Equipaggiamento automatico per professione (LPC)

## Comportamento

Gli abiti di lavoro dipendono dalla professione effettiva dell'abitante.
`appearanceForPublicSpace` applica gli elementi visivamente, senza modificare
l'aspetto civile persistito: chi perde il lavoro riprende il proprio abbigliamento.
Le Guardie **devono** indossare la Chainmail (`guard_chainmail`, semanticId
`guard`) e i civili non possono selezionarla dall'editor del personaggio.

| Professione | Divisa disponibile nella build | Accessorio |
| --- | --- | --- |
| Guardia | Chainmail + pantaloni neri | Elmo Barbuta: asset da importare |
| Agricoltore | Camicia/grembiule e pantaloni contadini | Annaffiatoio LPC funzionante |
| Taglialegna | Tunica e pantaloni da viaggiatore | Ascia: asset da importare |
| Fabbro | Divisa da lavoro contadina | Martello: asset da importare |
| Minatore | Abiti semplici da lavoro | Piccone: asset da importare |
| Medico | Kimono bianco | Cravatta, mascherina e occhiali: asset da importare |
| Giudice | Kimono nero | Capelli bianchi |
| Mago | Kimono viola, mantello | Cappello Celestial: asset da importare |

## Stato degli sprite

Le definizioni originali **esistono** nel repository Universal LPC pubblico e
sono ora presenti in `scripts/lpc-approved-assets.json`. Tuttavia il manifest
runtime `src/character-system/generated/lpc-manifest.json` e i PNG presenti
in `assets/character-packs/lpc/generated/` sono file generati: **aggiungere una
definizione JSON non importa automaticamente lo sprite nel gioco**.

Il generatore usa la copia locale autorizzata di Universal LPC:

```text
assets/source-packs/Universal-LPC-Full/Universal-LPC-Spritesheet-Character-Generator-master
```

Per completare l'import quando tale sorgente è disponibile sulla macchina:

```bash
python scripts/import_lpc_pack.py
npm run typecheck
npm test
npm run build:web
```

Controllare le variazioni a `lpc-manifest.json`,
`lpcAssetSources.ts`, `lpc-credits.json` e nei PNG generati. Prima
di pubblicare, verificare sia `idle` sia `walk` sulle corporature
male, female, teen e — se presenti — child/dwarf. Il generatore preserva
metadati di attribuzione e licenze degli asset originali. Non dichiarare un
accessorio visibile finché il suo sprite non è effettivamente nel manifest
e le animazioni non sono state testate.

### Definizioni upstream confermate

- `tools/tool_axe.json`, `tools/tool_hammer.json`, `tools/tool_pickaxe.json`
- `headwear/helmets/helmets/hat_helmet_barbuta.json`
- `headwear/hats/magic/hat_magic_celestial.json`
- `headwear/neck/neck_cravat.json`
- `headwear/accessories/facial_mask_plain.json`
- `headwear/accessories/glasses/facial_glasses_sunglasses.json`

I test `profession-uniforms-lpc.test.ts`,
`guard-chainmail-exclusive.test.ts` e `lpc-profession-import-catalog.test.ts`
proteggono rispettivamente vestiti visibili, esclusività della Chainmail
e configurazione del prossimo import.
