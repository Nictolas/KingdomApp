# 🚀 Deploy su GitHub e Vercel

## 📋 Prerequisiti

1. **Node.js LTS**: [nodejs.org](https://nodejs.org/)
2. **Git**: [git-scm.com](https://git-scm.com/)

Dopo l'installazione, **riavvia PowerShell**.

## 🎯 Deploy Automatico

Esegui lo script:

```powershell
.\deploy-github.ps1
```

Lo script:
- ✅ Verifica Node.js e Git
- ✅ Installa le dipendenze
- ✅ Inizializza il repository Git
- ✅ Crea il commit iniziale
- ✅ Ti guida per il push su GitHub

## 📤 Push su GitHub (Due Metodi)

### Metodo 1: Creazione Automatica (Consigliato) 🚀

Lo script crea la repository e fa il push automaticamente!

1. **Crea un Personal Access Token GitHub**:
   - Vai su: https://github.com/settings/tokens/new
   - Seleziona permessi **`repo`** (tutti)
   - Genera e **copia il token** (vedi `GITHUB-TOKEN.md` per dettagli)

2. **Esegui lo script**:
   ```powershell
   .\crea-repo-github.ps1
   ```

3. **Inserisci i dati richiesti**:
   - Nome repository (default: `mykingdom`)
   - Visibilità (Public/Private)
   - Username GitHub
   - Personal Access Token

Lo script:
- ✅ Crea la repository su GitHub
- ✅ Collega il repository locale
- ✅ Fa il commit e push automaticamente
- ✅ Apre il repository nel browser

### Metodo 2: Creazione Manuale

1. **Crea il Repository su GitHub**:
   - Vai su [github.com/new](https://github.com/new)
   - Nome: `mykingdom` (o quello che preferisci)
   - Visibilità: Public o Private
   - ⚠️ **NON** selezionare "Add a README file", ".gitignore" o "license"
   - Clicca **"Create repository"**

2. **Collega e Push**:
   ```powershell
   .\deploy-github.ps1
   ```
   
   Poi esegui:
   ```powershell
   git remote add origin https://github.com/TUO-UTENTE/mykingdom.git
   git push -u origin main
   ```

   **Sostituisci `TUO-UTENTE`** con il tuo username GitHub.

   Se ti chiede credenziali, usa il **Personal Access Token** come password.

### Verifica

Vai sul tuo repository su GitHub: dovresti vedere tutti i file del progetto! 🎉

---

## 🌐 Deploy su Vercel

### Metodo 1: Import da GitHub (Consigliato)

1. Vai su [vercel.com](https://vercel.com) e accedi (puoi usare GitHub)
2. Clicca **"Add New..."** → **"Project"**
3. Importa il repository `mykingdom` da GitHub
4. Vercel rileverà automaticamente:
   - Framework: Expo
   - Build Command: `npm run build:web`
   - Output Directory: `dist`
5. Clicca **"Deploy"**

Il deploy sarà completato in ~2 minuti! 🚀

### Metodo 2: Vercel CLI

```powershell
npm install -g vercel
vercel login
vercel
```

Segui le istruzioni interattive.

---

## 🔄 Aggiornamenti Futuri

Dopo ogni modifica al codice:

```powershell
git add .
git commit -m "Descrizione delle modifiche"
git push
```

Vercel aggiornerà automaticamente il deploy! ✨

---

## ❓ Problemi Comuni

### "git: command not found"
- **Soluzione**: Installa Git e riavvia PowerShell

### "remote origin already exists"
- **Soluzione**: Rimuovi e riaggiungi:
  ```powershell
  git remote remove origin
  git remote add origin https://github.com/TUO-UTENTE/mykingdom.git
  ```

### "Authentication failed" durante push
- **Soluzione**: Usa un Personal Access Token invece della password

### Vercel non trova il build
- **Soluzione**: Verifica che `vercel.json` sia presente e che `package.json` abbia lo script `build:web`

---

## 📝 File di Configurazione

Il progetto include già:
- ✅ `.gitignore` - Esclude file non necessari
- ✅ `vercel.json` - Configurazione Vercel per Expo Web
- ✅ `package.json` - Script `build:web` per il build

Tutto è pronto! 🎮
