# MyKingdom — verifica funzionale A/B su Android e iPhone fisici

## Ambito (29 ottobre 2026)

La PR Draft **#298** è la baseline per **200 veri componenti sprite nativi**; la PR Draft **#297** è il candidato con ottimizzazioni native. La #295 rimane la baseline **solo per marker semplici**; la #294 misura Phaser web e non può sostituire una prova nativa. I quattro file della fixture sprite devono rimanere identici in #297/#298 e la relativa CI di parità deve passare. Nessun merge, deploy o rilascio è autorizzato da questo documento.

Il nuovo strumento `scripts/audit-native-device-acceptance.mjs` è un **gate offline di completezza delle osservazioni manuali**, non uno strumento di misura. Controlla che le prove per 25/50/100/200 sprite e velocità 1×/2×/4× siano registrate separatamente su **Android e iPhone fisici**, per entrambe le build. Controlla anche dieci prove funzionali da svolgere con 200 sprite. Non controlla che i dati dichiarati siano veri, non verifica quale binario sia installato, non legge alcun dispositivo, non misura FPS/GPU, memoria o touch e non approva automaticamente una release.

## Preparazione

1. Verificare che la CI mirata e i bundle JavaScript Android/iOS/web siano verdi su entrambi i commit; ricordare che un bundle JS non è un APK/IPA installabile.
2. Produrre due **build native di sviluppo installabili**, una dal commit esatto della #298 e una dal commit esatto della #297, tramite ambiente e credenziali di sviluppo autorizzati. Annotare il commit Git completo di 40 caratteri per ciascuna. Non modificare le quattro fixture condivise in modo diverso tra i rami.
3. Installare e provare le due build **sullo stesso telefono** per piattaforma, mantenendo identici versione OS, frequenza schermo, zoom, posizione, condizioni termiche e scena. Non inserire IMEI, seriali, nomi di persone o altri identificativi nei report. Il campo `deviceClass` può contenere solo una descrizione generica (es. «Android 60 Hz» o «iPhone 120 Hz»).
4. Usare la scena `Sprite abitanti reali in tragitto ripetibile` per il confronto di movimento senza contesa intenzionale; ripetere separatamente in `Girovago casuale` per le collisioni. Aspettare occupazione completa, primo tragitto di tutti gli abitanti e stabilizzazione. Per misurare il movimento, il tempo di simulazione non deve essere 0×.

## Compilazione della matrice

Da una copia locale del repository:

```sh
node scripts/audit-native-device-acceptance.mjs --template > native-device-qa.json
```

Il modello inizia intenzionalmente con `commit: null`, `samePhysicalDeviceConfirmed: false` e tutte le osservazioni `not_run`. Non sostituire questi valori con `pass` senza avere realmente eseguito le prove. Inserire i due commit completi e, solo dopo aver controllato i telefoni, impostare `samePhysicalDeviceConfirmed: true` su ciascuna piattaforma. Per ogni scenario e controllo compilare **entrambi** `baseline` e `candidate` con `pass`, `fail` o `not_run`. Ogni prova eseguita richiede `notes` descrittive di almeno 12 caratteri; non includere identificativi personali.

La matrice contiene **12 scenari per piattaforma**: quattro popolazioni × tre velocità. Non si aggregano velocità o popolazioni diverse. Per le prove funzionali con **200 sprite** registrare separatamente:

- `single_tap`: selezione al primo tocco senza aprire schede indesiderate.
- `double_tap`: doppio tocco coerente con il comportamento della scheda.
- `pan_pinch`: pan e zoom senza disallineamento tra sprite e area toccabile.
- `collision_retry`: contesa di una cella, attesa e ripresa senza compenetrazione o blocco permanente.
- `pause_resume`: pausa prolungata, nessun avanzamento in pausa e nessun teletrasporto al resume.
- `background_foreground`: nessun movimento/timer in background e ripresa corretta senza aggirare la pausa manuale.
- `speed_switch_1_2_4`: cambi ripetuti 1×→2×→4×→1× senza salti o arrivi doppi.
- `route_replacement`: sostituzione del tragitto mentre è in corso; callback del percorso precedente non devono prevalere.
- `no_ghost_occupancy`: dopo interruzioni, collisioni e smontaggio, nessuna cella rimane occupata da un residente assente.
- `memory_stability_200`: sessione prolungata con 200 sprite e cicli di pausa/background; osservare memoria, crash e blocchi con strumenti del dispositivo. Il semplice `pass` resta una dichiarazione umana, non una misura numerica certificata.

Eseguire prima un audit preliminare anche con dati incompleti:

```sh
node scripts/audit-native-device-acceptance.mjs --manifest native-device-qa.json --allow-partial --json
```

Quando tutti gli scenari e controlli sono stati realmente provati:

```sh
node scripts/audit-native-device-acceptance.mjs --manifest native-device-qa.json --json
```

Senza `--allow-partial` il comando rifiuta matrici incomplete. Un `fail` è riportato come `manual_failure_requires_investigation` e produce exit code 2. Una matrice completa e senza fallimenti produce **`human_attestations_complete_review_still_required`**, mai un'approvazione automatica. L'audit è read-only e non effettua upload, ADB, installazioni o modifiche ai salvataggi.

## Prove quantitative indipendenti

Le attestazioni sopra non sostituiscono **almeno tre acquisizioni da 10 secondi per build e scenario** con i report del pannello JS e l'analisi `scripts/compare-native-ab-matrix.mjs`. Su Android, `scripts/compare-native-android-ui-matrix.mjs` analizza separatamente i dati `gfxinfo framestats` forniti dall'operatore: latenza di completamento dei frame View, **non FPS GPU**. Le finestre rolling corte e i buchi fra timestamp vanno segnalati; per misure complete servono Perfetto/FrameTimeline. Su iPhone usare strumenti nativi di Xcode/Instruments per UI/rendering, memoria e responsiveness; non attribuire ad iOS dati Android.

Le due matrici di prestazioni e questa matrice di correttezza hanno scopi diversi. Tutte devono essere esaminate con i commit, la configurazione dei telefoni e i problemi riscontrati prima di considerare un'integrazione. **Nessun risultato sintetico CI equivale a FPS fisici misurati.**

## Verifica automatica dello strumento

```sh
node --test tests/native-device-acceptance.test.mjs
```

La CI della #297 esegue gli otto test del gate insieme agli altri test offline. Questi test verificano completezza, rifiuto di prove inventate o incomplete, differenza dei commit, unicità degli scenari, gestione dei fallimenti e assenza di un'approvazione automatica. Non installano applicazioni e non simulano un touchscreen fisico.
