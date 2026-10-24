# MyKingdom — collaudo P2P fra telefoni (fase collegamento)

Stato: **procedura preparata, prove su due dispositivi NON ancora certificate**.
Questa fase non comprende baratti, trasferimenti di risorse, account o database.

## Prerequisiti

- Build **nativa** di MyKingdom compilata includendo `react-native-webrtc`. **Expo Go non basta**.
- Due telefoni, entrambi sulla **stessa Wi-Fi**, con comunicazione client-to-client consentita (evitare guest Wi-Fi con AP isolation).
- Funzionalità di rete locale consentita nelle impostazioni iOS se richiesta.
- Un metodo di condivisione di testo lungo (es. Telegram) fra i due telefoni; condividere i codici solo con l'altro giocatore.
- **Nessun** server di signaling, STUN o TURN. La prova è limitata alla LAN.

## Percorso positivo

1. Aprire il gioco su entrambi i dispositivi e accedere a **Mercato → Collega giocatori**.
2. Su A scegliere **Invita un giocatore**, generare `MKP2P1:` e condividerlo con B.
3. Su B scegliere **Ho ricevuto un invito**, incollare l'invito e premere **Genera la risposta**.
4. Condividere la risposta da B verso A.
5. Su A incollare la risposta e premere **Completa il collegamento**.
6. Verificare che **entrambi** mostrino «Collegato».
7. Premere **Verifica la connessione (ping)** su **A e B** e verificare il ritorno di una risposta su entrambi.
8. Interrompere da A, verificare la disconnessione su B; ripetere invertendo i ruoli.
9. Verificare che **nessuna risorsa** sia stata trasferita e che nessun login o database sia richiesto.

Eseguire almeno con coppie **Android↔Android, iPhone↔iPhone e Android↔iPhone** prima di dichiarare la feature pronta per il rilascio.

## Casi negativi

- Invito o risposta vuoti, con prefisso alterato, troncati o scaduti (30 minuti).
- Risposta generata per una sessione differente.
- Dispositivi su reti separate o Wi-Fi con isolamento tra client: non dichiarare «Collegato» senza canale dati effettivamente aperto.
- Chiusura dell'app, perdita del Wi-Fi o riavvio del pairing: nessun collegamento fantasma; nuovo invito richiesto.
- Expo Go o build senza modulo nativo: messaggio comprensibile, nessun crash.
- Codici incollati dentro la pagina web: funzionalità non disponibile.
- Permessi Android **CAMERA**, **RECORD_AUDIO** e **SYSTEM_ALERT_WINDOW** assenti dal manifest finale dell'APK.

## Evidenze da registrare

Per ogni coppia segnare build/commit, modelli dei due telefoni, OS, stessa Wi-Fi, esito invito, esito risposta, stato su A/B, ping da A/B, disconnessione e log d'errore (se presenti). **Non allegare codici SDP reali**, perché possono includere informazioni locali di rete.

## Gate di rilascio

Non unire la PR #278 né annunciare compatibilità Android/iOS finché le build native non passano e il percorso positivo sopra non funziona su due dispositivi reali. Il successo dei test di protocollo con peer simulati e di `expo prebuild` da solo non dimostra l'interoperabilità.
