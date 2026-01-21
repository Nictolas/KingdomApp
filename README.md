# MyKingdom (Android + iPhone)

Progetto base **cross‑platform** con **Expo + React Native**.

## 🚀 Setup Rapido (Windows)

### Metodo 1: Script Automatico (Consigliato)

1. Apri PowerShell nella cartella del progetto
2. Esegui lo script di setup:

```powershell
.\setup.ps1
```

Lo script verificherà Node.js e installerà tutto automaticamente!

### Metodo 2: Installazione Manuale

1. **Installa Node.js**:
   - Vai su [nodejs.org](https://nodejs.org/)
   - Scarica la versione **LTS** (Long Term Support)
   - Esegui il file `.msi` e completa l'installazione
   - **Importante**: assicurati che "Add to PATH" sia selezionato
   - **Riavvia PowerShell** dopo l'installazione

2. **Verifica l'installazione**:
   ```powershell
   node --version
   npm --version
   ```
   Dovresti vedere i numeri di versione.

3. **Installa le dipendenze**:
   ```powershell
   npm install
   ```

4. **Avvia il progetto**:
   ```powershell
   npm run start
   ```
   
   Poi scegli:
   - Premi `w` per **Web** (anteprima veloce)
   - Premi `a` per **Android** (richiede emulatore o device)
   - Premi `i` per **iOS** (solo su macOS) oppure usa **Expo Go** sul telefono

### Alternative di Avvio

```powershell
npm run web      # Avvia direttamente su web
npm run android  # Avvia su Android (richiede emulatore)
npm run ios      # Avvia su iOS (solo macOS)
```

## 📱 Usa Expo Go sul Telefono

1. Installa **Expo Go** dal Play Store (Android) o App Store (iPhone)
2. Avvia il progetto con `npm run start`
3. Scansiona il **QR code** che appare nel browser con Expo Go
4. Il gioco si aprirà sul telefono!

## 🚀 Deploy su GitHub e Vercel

### 🎯 Creazione Automatica Repository (Consigliato)

Lo script crea la repository e fa il push automaticamente!

1. **Installa prerequisiti** (se non li hai già):
   ```powershell
   .\installa-prerequisiti.ps1
   ```
   Questo aprirà i siti di download per Node.js e Git.

2. **Dopo l'installazione**, chiudi e riapri PowerShell.

3. **Crea un Personal Access Token GitHub**:
   - Vai su: https://github.com/settings/tokens/new
   - Seleziona permessi **`repo`** (tutti)
   - Genera e **copia il token** (vedi `GITHUB-TOKEN.md`)

4. **Esegui lo script automatico**:
   ```powershell
   .\crea-repo-github.ps1
   ```
   Lo script ti chiederà:
   - Nome repository (default: `mykingdom`)
   - Visibilità (Public/Private)
   - Username GitHub
   - Personal Access Token

5. **Deploy su Vercel**: Vai su [vercel.com](https://vercel.com), importa il repository da GitHub.

📖 **Guida completa**: Vedi `DEPLOY.md` per istruzioni dettagliate.

---

## Cosa c'è già

- Mappa 20x20 con **fiume**, **spiaggia** e **mare**
- **Castello** e **campo**
- **Alberi** e **miniere** random
- 6 personaggi con professione + nome casuale
- **Pan** con 1 dito, **pinch‑to‑zoom** con 2 dita
- Selezione fiume → **costruisci ponte**
- Pulsanti: reset, zoom, chiama Re, chiama Contadino

