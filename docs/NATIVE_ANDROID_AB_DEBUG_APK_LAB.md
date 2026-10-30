# MyKingdom — Android debug A/B lab, senza merge né rilascio

## Perché esiste

L'export JavaScript di Expo prova che i bundle sono generabili ma **non**
compila un APK installabile. Il workflow sperimentale
`.github/workflows/native-ab-android-debug-lab.yml` è un controllo
indipendente, limitato alle **pull request #297**, che prova a compilare
due pacchetti Android **DEBUG** da commit precisi, con lo stesso package
di laboratorio e dipendenze installate da `package-lock.json`:

- Controllo sprite reale: **#298** commit
  `6dfcb12337992418f812049bf4bc1e1c144f843c` (pinned).
- Candidato ottimizzato: **commit HEAD della #297** al momento del workflow.

Il workflow esegue `expo prebuild --platform android` in un checkout
temporaneo e poi `assembleDebug`. La configurazione Android generata
è modificata **soltanto sul runner**, per usare il package lab
`com.nictolas.mykingdom.perflab` e includere JavaScript nel debug APK
senza richiedere necessariamente un server Metro. Non salva queste
modifiche in Git, non cambia `app.json` nel repository, non firma un
pacchetto di produzione e non pubblica sul Play Store.

## Cosa verificare su GitHub Actions

1. Aprire la PR #297, verificare che i check del workflow
   **Native A/B Android debug lab (not a release)** siano conclusi.
2. Se entrambe le build sono riuscite, individuare negli artefatti del
   workflow `mykingdom-baseline-298-debug-qa` e
   `mykingdom-candidate-297-debug-qa`. Sono conservati per **sette
   giorni**, non sono versioni distribuite.
3. Ogni archivio dovrebbe contenere un APK e
   `BUILD-PROVENANCE.txt`, con SHA Git completa, package e SHA-256
   dell'APK. Confrontare gli SHA con quelli realmente testati prima di
   considerare una cattura.
4. Se il comando `prebuild` o `assembleDebug` fallisce, esaminare
   i log: **non** indicare il test nativo come superato. Gli export JS
   rimangono una verifica distinta.

Questa pipeline è intenzionalmente separata dalle suite native Node,
in modo che un errore Gradle non venga confuso con il comportamento di
timer, RAF o collisioni; il suo stato è una **verifica aggiuntiva**.

## Limiti e sicurezza

- Una build **debug** ha overhead di sviluppo: **non usare il suo FPS
  per dimostrare un guadagno prestazionale in release**. È utile per
  testare la presenza e la funzionalità della scena `__DEV__`, la
  compilazione Java/Kotlin, freeze/crash, pause e tap su un Android reale.
- Le due versioni hanno lo stesso package lab. Installarne una alla volta
  sul **medesimo dispositivo di prova**, isolando dati e impostazioni;
  non installarle sopra l'app usata quotidianamente.
- Non sono richiesti keystore di produzione, credenziali Play Store,
  firma distribuzione o permessi di scrittura GitHub.
- L'APK resta un artefatto GitHub Actions temporaneo e non è un deploy
  o una release; il processo NON installa nulla su un telefono.
- Un'eventuale compilazione verde **non** è una prova di fluidità.
  Le misure comparative definitive richiedono build *profiling/release
  equivalenti* su Android/iPhone fisici, profiler OS e la matrice A/B.
- Questo workflow **non produce un IPA**: per iPhone serve un ambiente
  macOS/Xcode con provisioning e un dispositivo autorizzato.
- Le quattro fixture dello scenario A/B devono restare identiche; il
  controllo di isolamento Git preesistente rimane vincolante. Le PR
  #295, #296 e #298 non vanno unite per eseguire il laboratorio.

Non è autorizzato alcun merge, deploy o rilascio sulla base di questo
workflow. La stima di avanzamento della sola fase nativa resta 80%
finché le verifiche dispositivi non sono state completate realmente.
