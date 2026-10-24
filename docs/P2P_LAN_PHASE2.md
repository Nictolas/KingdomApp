# My Kingdom: collegamento LAN P2P (fase 2)

Stato: protocollo implementato e testato, ma **non ancora collegato all'interfaccia del gioco**.

## Specifica corrente

- Android e iPhone; invito e risposta condivisi manualmente (es. tramite Telegram).
- I dati WebRTC includono informazioni sulla rete; condividere i codici soltanto con la persona che si vuole invitare.
- Sessione casuale a 128 bit, controllo della risposta e scadenza codice di 30 minuti.
- Negoziazione ICE in LAN, senza STUN, TURN, database o server di signaling.
- Canale dati con messaggi hello e ping/pong; trasferimenti di risorse volutamente esclusi.
- Nessun accesso alle chiavi usate per cifrare i salvataggi locali.
- L'impossibilità di alterare del tutto il gioco non è garantita: il client e i vecchi salvataggi possono essere manipolati.

## Attivazione sui dispositivi

Il progetto usa Expo SDK 57. Il plugin WebRTC pubblico documenta la compatibilità fino a Expo SDK 56. Prima dell'attivazione serve verificare un bridge nativo WebRTC compatibile con SDK 57 su Android e iOS, configurare le build native e collegare il gestore LanP2PSession alla schermata di invito/risposta.

I test attuali verificano il protocollo e simulano due peer: **non sono una prova di collegamento fra due telefoni reali**.

Le modifiche sono proposte in una pull request in bozza, sovrapposta alla PR dei salvataggi cifrati.
