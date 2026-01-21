# Script per completare il push su GitHub dopo l'installazione di Node.js
# Esegui questo script dopo aver installato Node.js e riavviato PowerShell

Write-Host "=== Completa Push su GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Aggiungi Git al PATH
$env:Path = "C:\Program Files\Git\cmd;" + $env:Path

# Verifica Git
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Write-Host "ERRORE Git non trovato!" -ForegroundColor Red
    exit 1
}
Write-Host "OK Git: $gitVersion" -ForegroundColor Green

# Verifica Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERRORE Node.js non trovato!" -ForegroundColor Red
    Write-Host "Installa Node.js da https://nodejs.org/ e riavvia PowerShell" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green

# Verifica npm
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "ERRORE npm non trovato!" -ForegroundColor Red
    exit 1
}
Write-Host "OK npm: $npmVersion" -ForegroundColor Green
Write-Host ""

# Installa dipendenze
if (-not (Test-Path "node_modules")) {
    Write-Host "Installazione dipendenze..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRORE durante l'installazione delle dipendenze" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK Dipendenze installate" -ForegroundColor Green
    Write-Host ""
}

# Verifica remote
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "Aggiunta remote..." -ForegroundColor Yellow
    git remote add origin https://github.com/Nictolas/KingdomApp.git
    Write-Host "OK Remote aggiunto" -ForegroundColor Green
    Write-Host ""
}

# Push su GitHub
Write-Host "Push su GitHub..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Per il push serve un Personal Access Token GitHub" -ForegroundColor Cyan
Write-Host "Crea un token qui: https://github.com/settings/tokens/new" -ForegroundColor Gray
Write-Host "Permessi necessari: 'repo' (tutti i permessi repo)" -ForegroundColor Gray
Write-Host ""
$token = Read-Host "Incolla il Personal Access Token" -AsSecureString
$tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
)

if ([string]::IsNullOrWhiteSpace($tokenPlain)) {
    Write-Host "ERRORE Token non valido!" -ForegroundColor Red
    exit 1
}

# Configura remote con token
$remoteUrl = "https://Nictolas:$tokenPlain@github.com/Nictolas/KingdomApp.git"
git remote set-url origin $remoteUrl

# Push
$env:GIT_TERMINAL_PROMPT = "0"
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Push completato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository disponibile su: https://github.com/Nictolas/KingdomApp" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Per deploy su Vercel:" -ForegroundColor Yellow
    Write-Host "1. Vai su https://vercel.com" -ForegroundColor White
    Write-Host "2. Importa il repository: KingdomApp" -ForegroundColor White
    Write-Host "3. Vercel rileverà automaticamente la configurazione" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERRORE durante il push!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "- Token non valido o scaduto" -ForegroundColor White
    Write-Host "- Token senza permessi 'repo'" -ForegroundColor White
    Write-Host "- Problemi di autenticazione" -ForegroundColor White
    Write-Host ""
    Write-Host "Crea un nuovo token qui: https://github.com/settings/tokens/new" -ForegroundColor Cyan
    Write-Host "Permessi necessari: 'repo' (tutti i permessi repo)" -ForegroundColor Gray
}
