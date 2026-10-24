# My Kingdom — fase 3, collegamento P2P mobile sperimentale

## Architettura

- Solo Android e iOS in **build native**. La pagina web resta una preview senza collegamento P2P.
- **Senza Supabase, database, server di signaling, STUN o TURN.**
- Due giocatori devono trovarsi sulla stessa rete Wi-Fi che permetta traffico diretto tra dispositivi (alcune reti isolano i client).
- Una connessione P2P si apre mediante **invito** e **risposta** WebRTC condivisi manualmente, per esempio via Telegram.
- Le descrizioni SDP possono esporre indirizzi IP privati e informazioni sulla rete locale: condividere privatamente.
- Il canale dati DTLS/WebRTC viene usato **solo per hello e ping/pong**. La verifica di due dispositivi reali non è ancora effettuata e nessuna risorsa è commerciabile in questa fase.
- Le chiavi di salvataggio cifrate restano sul dispositivo; non sono mai condivise via WebRTC.

## Dipendenze e build

Expo SDK 57 / React Native 0.86.3. `react-native-webrtc@124.0.8` è fissato come **esperimento compatibilità**, non come supporto ufficiale: il plugin pubblico WebRTC documenta una matrice fino a Expo SDK 56, non 57.

Questa modifica *non installa* il plugin esterno `@config-plugins/react-native-webrtc`, perché aggiunge permessi non necessari a un gioco di baratti (fotocamera, microfono, overlay). Usiamo solo Internet, stato della rete e su iOS la descrizione dell'accesso LAN. Il modulo viene collegato con l'autolinking di React Native/Expo.

Non usare Expo Go: è necessario costruire l'app con il modulo nativo. Prima di testare:

```bash
npm ci
npx expo prebuild --platform android --no-install --non-interactive
npx expo run:android
```

Su Mac con Xcode:

```bash
npm ci
npx expo prebuild --platform ios --no-install --non-interactive
npx expo run:ios --device
```

## Prova manuale su due telefoni

1. Entrambi i telefoni si collegano alla **stessa rete Wi-Fi**, senza isolamento dei client.
2. Sul telefono A aprire **Mercato → Collega un altro giocatore (P2P) → Invita**.
3. Condividere il codice generato tramite **Condividi l'invito**.
4. Sul telefono B aprire **Mercato → Ho ricevuto un invito**, incollare il codice e generare una risposta.
5. Inviare la risposta ad A, che la incolla e preme **Completa il collegamento**.
6. Verificare che su entrambi appaia **Collegato**. Premere **Verifica la connessione (ping)**: il contatore della risposta deve aggiornarsi.
7. Provare disconnessione, codice scaduto, rete interrotta, background dell'app e ripresa dopo riavvio. Non sono consentiti scambi economici finché i test reali non sono superati.

## Sicurezza e limitazioni

- Le credenziali ICE della sessione scadono; non sono sostitutive dell'autenticazione dell'identità del giocatore.
- I codici manuali non garantiscono da soli l'identità del peer (un codice sostituito durante la condivisione può permettere un attacco di interposizione).
- La cifratura dei salvataggi non elimina rollback, app modificate o scambi duplicati intenzionali: per gli scambi reali occorre prima definire e testare accantonamenti persistenti e riconciliazione bilaterale.
- Supporto su SDK 57 e Android+iOS **da confermare con build native e dispositivi reali**; una prebuild riuscita non prova che il modulo funzioni.
- Nessuna PR di questa serie va integrata o distribuita come multiplayer completo prima di questi controlli.
