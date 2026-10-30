# MyKingdom — cleanup terminale robusto su 200 residenti (29 ottobre 2026)

## Difetto individuato

Nella Draft #297, interrompere un segmento nativo chiamava `motion.stop()` prima di ripristinare la prenotazione della cella di origine. Se `cancelFrame` lanciava un'eccezione dopo aver invalidato l'ID RAF, la callback di reconciliamento non veniva eseguita. La cella di destinazione poteva quindi restare prenotata anche dopo l'arresto logico. `NativeResidentSegmentRunner.stop()` poteva saltare anche il reset del flag visivo `walking`. Analoghi skip erano possibili in unmount, passaggio in casa e disabilitazione del movimento libero quando una cancellazione timer/RAF falliva.

Questo è un difetto di *fault containment* verificato nel controllo del flusso, **non** un crash o un incremento FPS misurato su uno smartphone.

## Blocco di correzione

- `NativeResidentSegmentRunner.stop()` prova sia cancellazione RAF sia reset visivo anche quando uno dei due fallisce, propagando la prima eccezione anche se falsy (`null`, `0`, `undefined`).
- `nativeResidentRunCleanup(...steps)` esegue tutte le operazioni terminali senza nascondere errori; viene usata solo per cambi di percorso, stati casa/notte, fine girovagare e unmount, **mai nel loop caldo RAF/timer**.
- `MapWandererCharacter.native.tsx` evita di lasciare claim fantasma quando l'interruzione del movimento fallisce, mantiene la precedenza originariamente prevista di claim/rollback e completa il cleanup dei timeout indipendenti.
- Test nuovo `tests/native-resident-interruption-cleanup.test.ts` in CI nativa: 200 runner × 30 sostituzioni/interruzioni = **6.000 arresti** a 1×/2×/4×, con 1.200 eccezioni iniettate nell'adapter RAF, pausa/background, callback OS obsolete, invarianti delle 400 celle e verifica dell'isolamento dal renderer web.
- Gate statici confermano che il workflow esegua il nuovo test, senza modificare la CI generale né disabilitare il typecheck.

## Limiti e validazione

I test usano scheduler JavaScript fittizi. Gli esiti CI e i bundle JavaScript Android/iOS/web sono distinti dalla profilazione reale: non misurano FPS GPU/UI, latenza touch, memoria, batteria o temperatura. Un guasto reale anche nella callback `release` può impedire il ripristino della prenotazione; la funzione preserva l'errore invece di fingere un successo.

La #298 rimane la baseline A/B degli sprite reali; #295 è la baseline dei marker e #294 riguarda Phaser web. Nessuna modifica a GameContext, salvataggi, tempi di gioco, versione web o produzione. Prima di un eventuale merge servono CI sul commit definitivo e prove sullo stesso Android/iPhone fisici: 25/50/100/200 residenti, 1×/2×/4×, collisioni, interruzioni, casa/notte, pausa/background, touch, pan e zoom.
