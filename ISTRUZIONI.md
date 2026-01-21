# 🎮 Istruzioni Rapide - MyKingdom

## ⚡ Setup Veloce

### Passo 1: Installa Node.js

1. **Apri il browser** e vai su: https://nodejs.org/
2. **Scarica** la versione **LTS** (Long Term Support) - quella verde
3. **Esegui** il file `.msi` scaricato
4. Durante l'installazione, **assicurati** che "Add to PATH" sia selezionato (di solito lo è già)
5. **Completa** l'installazione
6. **CHIUDI E RIAPRI** PowerShell (importante!)

### Passo 2: Verifica l'installazione

Apri PowerShell e scrivi:

```powershell
node --version
npm --version
```

Dovresti vedere due numeri di versione (es. `v20.11.0` e `10.2.4`).

### Passo 3: Setup del Progetto

Nella cartella del progetto, esegui **uno** di questi comandi:

**Opzione A - Script automatico (PowerShell):**
```powershell
.\setup.ps1
```

**Opzione B - Script automatico (CMD/Batch):**
```cmd
setup.bat
```

**Opzione C - Manuale:**
```powershell
npm install
```

### Passo 4: Avvia il Gioco

```powershell
npm run start
```

Poi:
- Premi **`w`** per vedere l'anteprima su **Web** (più veloce!)
- Premi **`a`** per **Android** (serve emulatore o telefono connesso)
- Oppure usa **Expo Go** sul telefono (vedi sotto)

---

## 📱 Gioca sul Telefono con Expo Go

1. **Installa Expo Go**:
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iPhone: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Avvia il progetto**:
   ```powershell
   npm run start
   ```

3. **Scansiona il QR code** che appare nel browser con Expo Go

4. Il gioco si aprirà sul telefono! 🎉

---

## 🎯 Comandi Utili

```powershell
npm run start      # Avvia Expo (menu interattivo)
npm run web        # Avvia direttamente su web
npm run android    # Avvia su Android
npm run ios        # Avvia su iOS (solo macOS)
```

---

## ❓ Problemi Comuni

### "npm non riconosciuto"
- **Soluzione**: Node.js non è installato o non è nel PATH
- Riavvia PowerShell dopo l'installazione di Node.js
- Verifica con `node --version`

### "Porta 8081 già in uso"
- **Soluzione**: Chiudi altre app che usano quella porta
- Oppure usa: `npx expo start --port 8082`

### Errori durante `npm install`
- **Soluzione**: Assicurati di essere connesso a internet
- Prova: `npm cache clean --force` poi `npm install` di nuovo

---

## 🎮 Controlli del Gioco

- **Pan**: Trascina con 1 dito per muoverti nella mappa
- **Zoom**: Pinch con 2 dita per zoomare
- **Seleziona personaggio**: Tocca un personaggio per vedere le info
- **Costruisci ponte**: Tocca una casella del fiume, poi "Costruisci ponte"
- **Chiama Re/Contadino**: Tocca castello/campo e usa i pulsanti

Buon divertimento! 🏰👑
