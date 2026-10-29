# MyKingdom — prova con 200 componenti sprite REALI su Android/iOS

## Perché la prova precedente non bastava

La schermata di sviluppo `/native-perf` conteneva soltanto rettangoli animati mediante un unico `Animated.Value` e `useNativeDriver`. Era utile per isolare il costo di 25/50/100/200 view React Native, ma **non esercitava il vero motore dei 200 personaggi**: `MapWandererCharacter.native.tsx`, lo sprite sheet `character.png`, gli `AnimatedPressable`, il dispatcher RAF condiviso, i timer dei residenti, le collisioni o la cancellazione alla sparizione della schermata. Eventuali risultati di quel test da solo non possono confermare la scalabilità della mappa.

## Nuova modalità selezionabile, senza modificare il regno

Nella schermata riservata allo sviluppo (**`__DEV__`**, solo Android/iOS) ci sono due modalità distinte:

1. **Marker semplici:** carico sintetico precedente, 200 celle e un unico `Animated.Value` con animazione nativa; confronto per il solo layout di view semplici.
2. **Sprite abitanti reali:** fino a **200 istanze del componente `MapWandererCharacter` usato dalla mappa**, sulla griglia di prova **20×20 = 400 celle**. Ogni residente monta lo stesso sprite sheet del componente nativo, usa le sue reali callback `Pressable`, lo stesso `NativeResidentFrameBus`, il `NativeResidentTimerQueue` e i normali timer di girovagare, con occupazione della cella locale che rifiuta i passaggi su una cella di un altro residente. I test provano sia **Fermi** sia **Muovi**.

Il modello di occupazione riprende quello della mappa effettiva: due `Map` in memoria (`cella → proprietario` e `abitante → cella`); `tryClaimCell` trasferisce atomicamente il possesso da una cella all'altra, `isCellFreeForMe` distingue il proprietario dagli altri, `releaseMyCell` libera alla rimozione. Non legge né scrive il database dei personaggi, `GameContext`, la mappa salvata o lo storage del regno. Quando si passa da 25 a 200 abitanti, o da **Fermi** a **Muovi**, la fixture viene rimontata con un'occupazione distinta; nessuna vecchia cleanup può cancellare il possesso delle nuove istanze.

### Nota sulla velocità e sulle pause

Il renderer nativo usa lo stesso orologio di gioco della mappa. La prova **legge** `getOrologioSimTimeScaleSnapshot()` e si iscrive alle notifiche di velocità/pausa, ma **non altera mai il tempo del regno**. Se l'utente apre la schermata prima che il gioco sia stato avviato o mentre è in pausa, gli sprite possono essere fermi: compare un avviso esplicito. Per provare il movimento occorre prima iniziare/riprendere il gioco sulla mappa e poi entrare nella diagnostica. **Uno sprite fermo a velocità 0× non è una prova valida delle prestazioni di 200 residenti in movimento.**

### Baseline valida per un confronto fra versioni

Per misurare **gli stessi 200 sprite reali** sulla versione prima della #297 non basta usare la #295, che non contiene ancora `MapWandererCharacter.native.tsx`. È stata creata la **[PR #298](https://github.com/Nictolas/KingdomApp/pull/298)**, derivata dal motore #296, con la **stessa identica scena di sviluppo, fixture di occupazione e test** della #297: i quattro file sono stati verificati con lo **stesso SHA Git** in entrambi i rami. In questo modo il motore può essere confrontato in modalità A/B, senza confondere sprite diversi.

Usare dunque **#298 (baseline pre-297) contro #297 (candidata)** per la modalità `Sprite abitanti reali`; utilizzare #295 soltanto per un confronto dei vecchi `Marker semplici`. Le build devono mantenere lo stesso ambiente e stesso telefono. La #298 usa la diagnostica più vecchia e genera meno contatori: confrontare esclusivamente metriche disponibili in entrambi, verificando l'overhead della misura e aggiungendo un profiler esterno per FPS UI/GPU, GC e memoria.

### Come misurare

Aprire sulla mappa lo HUD di sviluppo, premere **«Prova 25–200 elementi»**. Nella schermata selezionare **«Sprite abitanti reali»**, prima 25, poi 50/100/200. Con il gioco a 1× e modalità **Muovi** verificare che gli sprite camminino realmente senza sovrapporsi in una singola cella, che il tocco e il doppio tocco funzionino, che **Fermi** fermi il girovagare e che tornare alla mappa non lasci callback attive della fixture. Aprire **«Dettagli»**, premere **«Misura 10 secondi»** e condividere il risultato; ripetere per almeno tre catture. Ripetere anche a 2× e 4×, con pause e background.

Prima di confrontare due build, usare sempre **la stessa modalità** (marker/real sprite), stesso numero di abitanti, stessa velocità, stesso telefono e stesso stato del pannello. La stringa **Scena** del report distingue la modalità vera (`Sprite abitanti reali in movimento`) dai marker precedenti (`Marker animati`), e l'analizzatore `scripts/compare-native-js-reports.mjs` rifiuta automaticamente le scene diverse.

## Test di correttezza automatizzati

`tests/native-real-resident-fixture.test.ts` copre: 25/50/100/200 spawn univoci su 400 celle, prenotazioni senza sovrapposizione, rifiuto atomico di una cella occupata, liberazione e riutilizzo del possesso, rifiuto di indici invalidi, **4.000 tentativi deterministici** di movimento con 200 residenti e invariante bidirezionale sempre conservata, rilascio completo e remount indipendente, oltre alla verifica statica che la schermata nativa carichi davvero il componente `MapWandererCharacter` e non tocchi salvataggi o funzioni di scrittura dell'orologio.

La CI diagnostica lancia questi test **insieme** alle regressioni del movimento nativo, agli stress test 200 residenti e ai bundle JS Android/iOS/web. Non simula collisioni visive pixel-per-pixel, input fisico touchscreen o rendering UI/GPU: questi vanno verificati sull'hardware.

## Rischi e limiti

Questa è una prova più realistica del precedente carico di marker, **non** un'intera partita MyKingdom con IA, alberi, edifici, lavoro, religioni o salvataggi. L'occupazione riguarda solo la griglia sintetica della schermata; la geometria di un regno reale può essere diversa. I numeri del pannello rimangono metriche **del thread JavaScript**, non FPS GPU/UI. Il percorso è interamente `__DEV__`, non viene abilitato per gli utenti finali. Nessun merge, deploy o rilascio senza verifica CI e misure su dispositivi reali.

## 28 ottobre — isolamento dei tocchi dal carico dei 200 sprite (A/B identico)

**Problema rilevato nell'harness:** il feedback di un tocco era uno `useState` nel componente padre di tutti gli sprite. Selezionare un residente poteva quindi rieseguire il render React di tutti e 200 i wrapper, alterando le misure di reattività touch e aumentando il rumore del test. Anche la sottoscrizione alla velocità di gioco risiedeva nel componente padre.

**Correzione condivisa con la #298:** un `NativeRealFixtureSelection` in memoria notifica esclusivamente il piccolo overlay di stato tramite `useSyncExternalStore`. Anche la sottoscrizione all'orologio è stata spostata nell'overlay. I 200 residenti ora sono figli `memo` separati, con callback stabili (`useCallback`) per tap, occupazione, arrivo e rilascio; la selezione di un abitante non aggiorna più lo stato React del loro genitore. Cambio popolazione e passaggio Fermi/Muovi continuano a rimontare il carico, così da azzerare correttamente l'occupazione.

**Regressioni aggiunte:** notifiche idempotenti, disiscrizione, isolamento tra fixture e **200.000 selezioni sintetiche** su 200 target. Il test statico impedisce di reintrodurre `setSelected` nel componente padre e controlla la separazione overlay/sprite. Sono test di logica e confine sorgente: non misurano re-render effettivi tramite profiler React né latenza fisica del touch.

I tre file condivisi (fixture, workload, test) sono stati applicati con contenuto SHA-identico a #297 e #298. Non attribuire eventuali differenze A/B a questa modifica, che è presente in entrambe. Le misure reali restano da effettuare su Android e iPhone.

## 29 ottobre — seconda scena A/B: tragitto ripetibile (nessuna prova hardware)

La scena `Sprite abitanti reali in tragitto ripetibile` usa **gli stessi quattro file** sui due rami e lo stesso componente nativo di ciascun motore. Ogni abitante percorre ripetutamente una corsia orizzontale di due celle adiacenti, poi torna indietro; le corsie non si sovrappongono, anche con 200 residenti. La modalità precedente `Sprite abitanti reali in movimento` resta il **girovagare casuale** con contese di occupazione. La nuova modalità isola il costo del movimento/RAF e dei cambi di direzione da differenze casuali nel percorso, ma **non misura collisioni o IA completa**.

Per confrontare #298 e #297 scegliere la stessa modalità, popolazione, velocità, dispositivo e durata. Non mescolare i report delle due scene. Per la nuova modalità servono ancora tre catture per scenario (25/50/100/200 × 1×/2×/4×) e profiler Android/iOS per FPS UI/GPU, touch, memoria e consumo. Le prove Node sulle corsie e la CI non sono misure su telefono; nessun merge o rilascio.


## 29 ottobre — indicatore di occupazione pronta per il confronto A/B

Le scene con sprite reali di entrambe le PR (#297 e #298) mostrano ora
«Occupazione pronta» solo dopo che tutti i 25/50/100/200 residenti hanno
prenotato una cella della fixture. Se un residente non ha ancora effettuato
la prenotazione, appare «Occupazione sprite non pronta». La pausa può
impedire le prenotazioni iniziali in modalità movimento, mentre in modalità
«Fermi» la scena può essere pronta anche con il gioco in pausa: per questo
il controllo separato della velocità 0× rimane obbligatorio.
Attendere lo stato pronto e qualche secondo di stabilizzazione prima di
avviare «Misura 10 secondi». L'indicatore **non blocca** tecnicamente il
pulsante di misura: l'operatore deve controllarlo. Non certifica il rendering
visibile, gli FPS UI/GPU, le collisioni pixel o l'IA completa.

Lo stato è un booleano in uno store locale della fixture. Il piccolo overlay
è l'unico sottoscrittore; i 200 sprite non vengono aggiornati a ogni
prenotazione. Il test simula **200 abitanti × 240 spostamenti (48.000 claim)**
e verifica nessuna notifica durante il movimento, invalidazione dopo release,
riattivazione dopo claim e assenza di notifiche dopo disiscrizione. Stessa
implementazione sui due rami, senza modifiche a orologio, salvataggi o gioco.
