# Native CI — gate indipendenti e correzione regressione TypeScript (29 ottobre 2026)

## Problema verificato sulla Draft #297

Il workflow nativo del commit `caf66a70` (run [40928751344](https://github.com/Nictolas/KingdomApp/actions/runs/40928751344)) ha fallito il gate TypeScript additivo per **un errore nuovo**:

`tests/native-resident-raf-rearm-fault.test.ts(142,31): TS2367`, confronto statico impossibile tra `1` e `2`.

Il test invocava `assert.ok(counts.every(n => n === 1))` e poi `assert.ok(counts.every(n => n === 2))` dopo un tick. TypeScript restringeva il tipo degli elementi dell'array sulla base della prima asserzione; il controllo runtime su 200 residenti rimaneva necessario. La seconda verifica confronta ora l'array completo con i 200 valori attesi, senza introdurre cast o disabilitare controlli.

Poiché il gate TypeScript era un normale step fallente, **tutte le 16 suite successive erano saltate** nella stessa run, mentre i bundle JS Android/iOS/web erano riusciti. Questo impediva di sapere se il test RAF o altri stress test avrebbero effettivamente passato.

## Modifica end-to-end

- Il gate TypeScript additivo conserva il proprio script e la baseline bloccata di 53 errori legacy della #295. Ottiene un ID esplicito e `continue-on-error: true` soltanto per continuare con le suite successive.
- Il gate finale `if: always()` controlla **17 esiti indipendenti**: l'esito reale del gate TypeScript più le 16 suite. Un gate fallito/cancellato/saltato continua a rendere rosso il job; **non** viene mascherato dal permesso di proseguire.
- Test statici di isolamento del workflow richiedono sia l'esecuzione indipendente del gate sia la sua inclusione nel controllo finale; test dedicato alla regressione TypeScript sulla verifica delle 200 callback.
- La CI generale rimane invariata e rigorosa, inclusi i 53 errori legacy. Le build nativo/web restano solo export JavaScript. Non è stato modificato il runtime del renderer, né il confronto con la #298.

## Evidenza e prossime verifiche

Confermati sulla run precedente: bundle JavaScript Android, iOS e web **SUCCESS**; test nativi **NON ESEGUITI** perché interrotti dalla regressione TypeScript; CI generale **FAILURE**, comprendente errori preesistenti più il TS2367 nuovo. Le successive esecuzioni dovranno mostrare il gate additivo senza regressioni e l'esito effettivo di tutte le 16 suite.

L'effetto delle modifiche è una migliore copertura diagnostica e una correzione di test, **non un miglioramento FPS**. Mancano test su Android/iPhone fisici (25/50/100/200 sprite, velocità 1×/2×/4×, tocchi, collisioni, pausa/background, FPS UI/GPU). Nessun merge, deploy, salvataggio o cambiamento a GameContext/web.
