# MyKingdom — Android/iOS AppState, focus e 200 residenti nativi (29 ottobre 2026)

## Bug e motivazione

Il lifecycle nativo della Draft #297 interpretava `AppState.currentState === null` e ogni stato sconosciuto come **foreground** perché controllava soltanto che lo stato non fosse `background` o `inactive`. React Native documenta che il valore può essere `null` all'avvio sulla vecchia architettura e che solo `active` indica espressamente foreground. Su Android, il pannello notifiche può emettere `blur` senza modificare `AppState`: il vecchio listener `change` continuava quindi a tenere attivi RAF e timeout dei residenti durante la perdita del focus.

Riferimento ufficiale: https://reactnative.dev/docs/appstate .

## Intervento native-only

- `NativeResidentAppVisibility` autorizza l'esecuzione **solo** con `AppState === "active"`; uno stato `null`, `unknown`, `inactive`, `background` o non riconosciuto sospende la coda RAF e i timeout. Su Android è richiesto inoltre il focus; `blur` sospende e `focus` riprende soltanto se AppState è ancora `active`. Su iOS continua a bastare il normale evento `change`.
- Il listener resta **uno per piattaforma, non 200 per residenti**: un `change` (Android/iOS), più un `blur` e un `focus` su Android. Non vengono creati timer, loop, storage o nuove letture GameContext.
- La registrazione dei tre osservatori è atomica nei limiti dei remover restituiti dal bridge: se un successivo `addEventListener` fallisce, vengono rimossi gli osservatori già registrati. Le callback native arrivate in ritardo sono ignorate dopo la chiusura. In fase di cleanup, un remover difettoso non impedisce la rimozione degli altri; l'errore originario viene propagato anche se falsy.
- Le notifiche duplicate (anche `active`) sono inoltrate intenzionalmente al gate esistente: sono necessarie per ritentare la registrazione RAF dopo guasti transitori, senza polling.
- Il comportamento riguarda soltanto l'animazione e i timeout dei residenti nativi. **Non cambia il clock di gioco globale, le regole, GameContext, i salvataggi, la mappa web o la fixture A/B #298.** La fase native è sospesa anche quando lo stato del sistema è ambiguo (fail closed).

## Stress e regressioni

Il nuovo test `tests/native-resident-app-visibility.test.ts`, incluso nel workflow nativo, verifica tutti gli stati e le transizioni Android/iOS, installer/rollback, eventi obsoleti, avvisi ripetuti e 100 sequenze di blur/focus con un solo gruppo di listener. Integra un modello JavaScript di **200 runner di segmenti e 200 scadenze** per ciascuna velocità 1×/2×/4×; controlla zero RAF/timer durante stato sconosciuto e sfocatura, riattivazione senza salto, rilascio dei subscriber e 200 timeout processati in batch. Sono prove sintetiche (OS simulato), non test fisici.

## Limiti e prova manuale

Il focus Android non ha un getter iniziale universale: prima del primo `blur` del bridge, lo stato `active` viene considerato focalizzato; da allora si usa il reale flusso di eventi. Nessuna prova FPS, GPU, latenza touch o memoria reale è dimostrata dal test.

Verificare in un APK Android di sviluppo che tirare giù la tendina notifiche fermi il movimento dei 200 sprite senza teletrasporti, anche durante una collisione e una pausa manuale. Dopo `focus`, il movimento deve riprendere solo se la pausa manuale lo consente. Su iPhone verificare `active` → `inactive` → `active`, background/foreground, chiamate di sistema e livelli 25/50/100/200 a 1×/2×/4×. Il laboratorio vero confronta **#298 vs #297**, non #295. Bundle Expo JS non sono APK/IPA: nessuna misurazione hardware è stata eseguita.

CI dedicata + export Android/iOS/web e differenziale TypeScript necessari sul commit finale, indipendentemente dai 53 errori legacy della CI generale. Nessun merge, deploy o release.

## Asynchronous AppState bootstrap without a change event

In React Native's legacy architecture, `currentState` may be `null` at launch and become `active` asynchronously without an accompanying state-change event. Fail-closed startup must not strand 200 walkers indefinitely in that case.

The single native lifecycle observer now performs a second synchronous snapshot read **after** event registration, then up to four **one-shot** rechecks at 50, 150, 450 and 1000 ms only while the state remains null/unknown. It stops immediately once the bridge resolves. When the four checks are exhausted, the scheduler remains paused until a later authoritative `change` event; there is no infinite polling, timer per resident or modification of the game clock. Generation tokens discard late canceled probes, and the standard cleanup still removes the AppState listeners even if canceling a probe throws.

Synthetic tests verify silent bridge resolution, four-check ceiling, zero extra timeouts for known states and error-safe teardown. This is not proof of a physical device's launch timing.
