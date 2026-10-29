# MyKingdom — provenienza delle build per la matrice A/B nativa (29 ottobre 2026)

## Problema e ambito

Il validatore offline delle 72 catture JS (12 scenari × 3 ripetizioni × 2 build) poteva restituire lo stato «pronto per revisione» con il solo `samePhysicalDeviceConfirmed: true`, senza sapere quali commit fossero stati effettivamente compilati e installati. Due insiemi di report della **stessa** build potevano quindi essere etichettati #298 → #297. La nuova verifica è un **gate di provenienza dichiarata dall'operatore**, non un controllo crittografico dei binari o una prova di prestazioni.

Non cambia il renderer, la simulazione, le velocità 1×/2×/4×, i tocchi, GameContext, salvataggi, il web, la fixture A/B né alcuna build pubblica.

## Manifest v2

Il validatore `scripts/compare-native-ab-matrix.mjs` accetta ancora `schemaVersion: 1` per analisi storiche, ma una matrice completa v1 è **solo preliminare** (`preliminary_legacy_manifest_no_build_provenance`). Per lo stato `js_diagnostics_ready_for_manual_device_review` serve `schemaVersion: 2`, una matrice completa e questi campi, oltre ai campi v1:

```json
{
  "schemaVersion": 2,
  "platform": "android",
  "scene": "Sprite abitanti reali in tragitto ripetibile",
  "samePhysicalDeviceConfirmed": true,
  "sameDeviceConditionsConfirmed": true,
  "fixtureParityConfirmed": true,
  "builds": {
    "baseline": {
      "pr": 298,
      "commit": "<SHA Git di 40 caratteri del binario baseline installato>",
      "installedOnPhysicalDeviceConfirmed": true
    },
    "candidate": {
      "pr": 297,
      "commit": "<SHA Git di 40 caratteri del binario candidato installato>",
      "installedOnPhysicalDeviceConfirmed": true
    }
  },
  "scenarios": []
}
```

`scenarios` è un segnaposto illustrativo: deve contenere i **12 scenari reali** con file di report, popolazioni e velocità secondo `docs/NATIVE_REAL_SPRITE_AB_MATRIX.md`; un array vuoto viene rifiutato. Gli SHA tra parentesi angolari non sono valori validi: sostituirli con gli SHA effettivamente usati per compilare **le due build installabili**. Non copiare automaticamente l'ultimo SHA di GitHub se il telefono ha ancora un binario precedente.

L'operatore deve confermare, **prima** di impostare i flag a `true`: (1) che la baseline è stata costruita dalla PR #298 e la candidata dalla #297, con SHA distinti; (2) che entrambe sono state realmente installate sullo stesso dispositivo; (3) che i quattro file condivisi della fixture hanno lo stesso blob Git; (4) che temperatura, alimentazione, orientamento, OS e condizioni di test sono confrontabili. Il gate rifiuta SHA non esadecimali o non lunghi 40 caratteri, SHA identici, PR invertite e attestazioni mancanti.

**Limite decisivo:** gli SHA sono *dichiarati manualmente* e il testo del report JS non certifica la provenienza del pacchetto installato. Il risultato espone `buildProvenance.verification = human_attestation_only_not_binary_or_device_verified`. Il gate non può scoprire una falsa attestazione, un telefono differente, un binario installato dal commit sbagliato, o un cambio di impostazioni tra le catture. È opportuno conservare i log di compilazione, gli hash dei binari e una scheda manuale delle condizioni, senza dati personali.

## Verifiche e limiti

I test Node `tests/native-ab-matrix.test.mjs` coprono una matrice completa v2 di 72 report sintetici, la compatibilità v1 senza promozione impropria, commit errati/identici, PR invertite, attestazioni mancanti e matrice v2 parziale. Sono già inclusi nella suite CI nativa; restano test **di logica offline**, non misure su Android/iPhone. Le compilazioni `expo export` sono solo bundle JavaScript, non APK/IPA installabili.

Restano indispensabili test su **Android e iPhone fisici** con 25/50/100/200 sprite reali a 1×/2×/4×, almeno tre catture per lato, misure OS dei frame UI/GPU, verifiche manuali di collisioni, tocco/doppio tocco, pausa e background. Nessuna percentuale FPS può essere dedotta da questo gate e nessun merge/deploy è autorizzato.
