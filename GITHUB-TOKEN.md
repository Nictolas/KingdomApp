# 🔑 Come Creare un Personal Access Token GitHub

Per creare automaticamente la repository su GitHub, serve un **Personal Access Token (PAT)**.

## 📝 Passo-passo

### 1. Vai alle Impostazioni GitHub

Apri: https://github.com/settings/tokens/new

Oppure:
1. Vai su [github.com](https://github.com)
2. Clicca sulla tua **foto profilo** (in alto a destra)
3. Clicca **Settings**
4. Nel menu a sinistra: **Developer settings**
5. Clicca **Personal access tokens** → **Tokens (classic)**
6. Clicca **Generate new token** → **Generate new token (classic)**

### 2. Configura il Token

- **Note**: `MyKingdom Setup` (o quello che preferisci)
- **Expiration**: Scegli una durata (es. 90 giorni, o No expiration)
- **Scopes**: Seleziona **`repo`** (tutti i permessi repo)
  - ✅ repo
  - ✅ repo:status
  - ✅ repo_deployment
  - ✅ public_repo
  - ✅ repo:invite
  - ✅ security_events

### 3. Genera e Copia il Token

1. Clicca **Generate token** (in fondo)
2. **⚠️ IMPORTANTE**: Copia subito il token! Non lo vedrai più!
3. Incollalo nello script quando te lo chiede

### 4. Usa il Token

Quando esegui `.\crea-repo-github.ps1`, incolla il token quando richiesto.

---

## 🔒 Sicurezza

- **Non condividere** il token con nessuno
- **Non committare** il token nel codice (è già in `.gitignore`)
- Se il token viene compromesso, **revocalo** subito e creane uno nuovo
- Puoi revocare token da: https://github.com/settings/tokens

---

## ✅ Alternative

Se preferisci creare la repository manualmente:

1. Vai su https://github.com/new
2. Crea la repository
3. Poi esegui `.\deploy-github.ps1` e segui le istruzioni
