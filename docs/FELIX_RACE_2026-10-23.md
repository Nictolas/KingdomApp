# My Kingdom — razza Felix

Data: 23 ottobre 2026.

## Definizione
**Felix** è una razza giocabile come abitante/NPC, con aspetto base umano e orecchie da gatto. Nome razza: `Felix` (ID grafico `felix`). Gli abitanti Felix possono comparire anche come immigrati e nella schermata Razze.

## Garanzia inizio partita
Per ogni nuova partita **Creativa e Avventura** esiste sempre esattamente un abitante iniziale di razza Felix. La conversione in Felix avviene **al termine** dell'assegnazione dei ruoli, dopo Nativi/Golem/Consigliere/Ex Sovrano (e dopo i personaggi speciali di Avventura), scegliendo un residente umano diverso dal Re, dal Consigliere e dall'Ex Sovrano. Non aumenta il numero iniziale degli abitanti e non riassegna personaggi obbligatori. Ogni Felix riceve nome fantasy, emoji e aspetto LPC coerenti. Non vengono aggiunti Felix retroattivamente alle partite iniziate prima della modifica.

## Regola grafica obbligatoria
Tutti i Felix, a qualsiasi età e corporatura, devono visualizzare contemporaneamente:
1. `Ears > Furry Ears > Top of Head > Cat Ears` — colore del pelo casuale per individuo, selezionato da `black`, `chestnut`, `blonde`, `ginger`.
2. `Ears > Furry Ears > Top of Head > Cat Ears Skintone` — colore indipendente casuale per individuo, selezionato da `light`, `amber`, `olive`, `brown`.

Entrambi gli asset hanno layer `fg` e `bg` originali e sono disegnati per `idle` e `walk`. Le due scelte vengono memorizzate come `catEarsColor` e `catEarsSkintoneColor`: non cambiano casualmente a ogni rendering/riavvio. `enforceRaceBodyTypeRules` impone `earsStyle: "cat_ears"` ai Felix anche quando vengono modificati, diventano incinti o vengono caricati da salvataggi. Il rendering richiede 2 livelli Cat Ears + 2 Cat Ears Skintone.

## Texture e licenze
Asset originali del repository Universal LPC `LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator`, commit pinned `9bf06be193b053db256b2536824af426de046aa2`:
- `sheet_definitions/head/furry_ears/top/head_ears_cat.json`
- `sheet_definitions/head/furry_ears/top/head_ears_cat_skin.json`

Script `scripts/import_felix_cat_ears.py`. I 64 PNG esportati combinano due definizioni, adult/child, fg/bg, idle/walk e quattro colori. I 192 layer nel manifest servono le sei corporature male/female/teen/child/muscular/pregnant. Ulteriori 12 voci riusano la testa umana male per la corporatura muscular quando necessario. Licenze e autori originali sono nell'archivio `src/character-system/generated/lpc-credits.json`.

## Verifiche
`tests/felix-race-initial-ears.test.ts` testa:
- 60 partite per ciascuna modalità (120 totali): un Felix e Re/Golem/Consigliere preservati.
- 4 layer di orecchie su sprite reali `idle` e `walk`, su tutte le corporature, con colori indipendenti.
- Conservazione dei colori nel ciclo di vita, incluso cambiamento professione e vecchio aspetto umano.
- File PNG e metadati di attribuzione.

Il collaudo visivo di allineamento/livelli orecchie nel browser e su dispositivo mobile resta distinto dai test automatici.
