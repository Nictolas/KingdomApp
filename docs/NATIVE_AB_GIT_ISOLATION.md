# MyKingdom — isolamento Git del laboratorio A/B nativo

## Obiettivo

La baseline **Draft #298** deve contenere il motore nativo precedente alle ottimizzazioni della **Draft #297**, pur usando **esattamente la stessa scena** con 25/50/100/200 sprite reali. Entrambe devono derivare dalla **Draft #296**. La #295 rimane una baseline per i soli marker, mentre #294 è il benchmark web Phaser, fuori dal confronto.

Il controllo `scripts/audit-native-ab-git-isolation.mjs` verifica **oggetti e storia Git**, non misure prestazionali. È read-only, senza richieste di rete, scritture, merge o modifiche a GameContext/salvataggi.

## Invarianti automatiche

1. Gli SHA di #296, #298 e #297 sono tre commit distinti e risolvibili. Il loro **merge-base** è esattamente l'HEAD corrente di #296: un aggiornamento parallelo di #296 richiede una nuova verifica, non viene ignorato.
2. I quattro blob Git della scena e della fixture sono identici tra #298 e #297: `app/native-perf.tsx`, `NativeRealResidentWorkload.tsx`, `nativeRealResidentFixture.ts`, `native-real-resident-fixture.test.ts`.
3. #298 modifica rispetto a #296 solo questi quattro file e i tre file di laboratorio ammessi: `NativePerformanceHud.tsx`, `NATIVE_AB_BASELINE_PARITY.md`, workflow nativo. Nessun codice del motore, web o gameplay.
4. Cinque percorsi critici del motore nativo sono byte-identici tra #296 e #298, inclusa l'assenza della timer queue dove non esisteva. #297 deve contenere una timer queue diversa dalla baseline.
5. Ogni errore produce **exit code non-zero** e blocca il job nativo; non viene trasformato in avviso.

La CI #297 esegue otto test Git locali (inclusi drift della fixture, contaminazione del renderer, cambi alla base e assenza della timer queue), quindi l'audit sulle tre branch remote. Gli SHA sono risolti una sola volta all'inizio del controllo, per evitare risultati misti se le branch avanzano.

## Esecuzione

Nel checkout locale completo, dopo aver recuperato le tre branch:

```sh
git fetch --no-tags origin \
  +refs/heads/perf/native-resident-imperative-motion-20261028:refs/remotes/origin/perf/native-resident-imperative-motion-20261028 \
  +refs/heads/perf/native-real-sprite-ab-baseline-20261028:refs/remotes/origin/perf/native-real-sprite-ab-baseline-20261028 \
  +refs/heads/perf/native-resident-timer-batching-20261028:refs/remotes/origin/perf/native-resident-timer-batching-20261028
node --test tests/native-ab-git-isolation.test.mjs
node scripts/audit-native-ab-git-isolation.mjs --json
```

Il checkout CI deve avere storia sufficiente per calcolare il merge-base; si usa `fetch-depth: 0` nel job di test nativi. I tre bundle JavaScript rimangono indipendenti.

## Limiti e criteri di rilascio

Un audit Git verde **non dimostra** che l'APK/IPA installato corrisponda al commit dichiarato. Prima del confronto su dispositivo, l'operatore deve confermare manualmente commit e build installate per #298 e #297. Servono poi almeno tre catture comparabili per scenario, velocità 1×/2×/4× e 25/50/100/200 abitanti, oltre a prove fisiche di touch, collisioni, pausa/ripresa e profiling UI/GPU.

I test Node e i bundle Expo non misurano FPS, memoria, batteria o latenza fisica. Nessun esito di questo controllo autorizza merge, deploy o rilascio.
