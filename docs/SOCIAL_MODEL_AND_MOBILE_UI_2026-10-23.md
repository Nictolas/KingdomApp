# My Kingdom — Unificazione sociale e barre mobile (23 ottobre 2026)

## Decisione di design

- **Soddisfazione**: unica caratteristica individuale di benessere e consenso, a punti, aggregabile come media dei cittadini (escluso il Re e i Golem). Fasce: Devoto (>=5), Soddisfatto (>=2), Neutrale (>=-1), Insoddisfatto (>=-4), Ostile (<-4).
- **Timore**: 0–100, indica la paura delle conseguenze di opporsi al Re e alle Guardie. Non aumenta la soddisfazione, ma pesa sulle decisioni di rivolta: la propensione di un Ostile è 1 − 0,75 × (timore/100). Timore=100 conserva il 25% del potenziale di ribellione. Esecuzioni ordinate dal Re incrementano il Timore dei superstiti di 10 (massimo 100).
- **Felicità e Lealtà**: non si generano né si conservano più per i nuovi abitanti. I vecchi valori vengono convertiti una volta in un modificatore permanente limitato a ±3 e successivamente rimossi; le vecchie chiavi sono mantenute come facoltative di sola migrazione. Per compatibilità alcuni consumer storici utilizzano ancora una funzione dal nome legacy che deriva una rappresentazione 1–100 dalla soddisfazione, dai bisogni, dalle leggi e dall'alloggio: non è una seconda statistica persistita.
- **Paura**: vecchia chiave convertita in Timore. I vecchi URL Felicità/Lealtà reindirizzano a Soddisfazione; Paura reindirizza a Timore.

## Modificatori di Soddisfazione

Già implementate tre durate: permanente, giornaliera, mensile. Giornalieri e mensili scadono a tempo; i permanenti sopravvivono a ogni pulizia automatica.

**Lutto**:
- Familiare morto per altre cause: −1 permanente.
- Familiare ucciso per ordine del Re: −3 permanente.
- Amico ucciso per ordine del Re: −1 permanente.
- Un familiare che è anche amico riceve solo −3; ciascuna vittima ha un ID modificatore distinto (es. lutto_123), impedendo duplicati per la stessa vittima e permettendo accumulo di lutti per vittime diverse.
- I parenti considerati sono coniugi, genitori, figli, fratelli/sorelle; amicizie bilaterali o unilaterali.
- La perdita di parenti non è causata soltanto dall'azione del Re: ribellioni, omicidi ordinari e guerre civili conservano il malus −1.

**Altri eventi migrati**: grazia del Re (+1 persone interessate / −1 rivali), Rivoluzionari delusi (−1 mensile), Guerra Civile (−1/−2 mensile), Proteste degli Autoctoni (−1 mensile). Gli eventi di assimilazione ed emigrazione usano il livello di soddisfazione contestuale, non un valore Felicità archiviato.

## UI responsive mobile

In `app/mappa.tsx`:
- Barra superiore: due righe capaci di andare a capo: titolo compatto, Diario, Menu; data/ora con pausa/velocità, soddisfazione media, numero abitanti.
- Barra inferiore: risorse in scorrimento orizzontale indipendente e tre azioni fisse Costruisci / Richieste / Eventi. Le azioni non scompaiono quando si seleziona un abitante, la cui scheda sintetica resta in area separata.
- Griglia attivata automaticamente con Costruisci e Demolisci e disattivata all'uscita; niente pulsante Griglia fisso.
- Demolisci spostato dentro la finestra Costruisci; rimane la conferma prima di demolire.
- Aumentata l'altezza del footer e aggiunto spazio di sicurezza inferiore sulle web app iOS. Fare QA manuale su iPhone per verificare safe area, vari formati e orientamento.

## Verifiche e limiti

- 502 test automatici (497 preesistenti più 5 nuovi), test TypeScript.
- Verifica build web: registrare risultato effettivo separatamente.
- Collaudo visivo mobile non svolto durante la modifica.
- I nomi di alcuni helper TypeScript mantengono compatibilità con i vecchi consumer. I vecchi salvataggi vanno verificati con carichi realistici prima del merge.
- Nessun merge o deploy in produzione automatico di questa modifica.
