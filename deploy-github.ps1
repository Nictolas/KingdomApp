# Script per pubblicare MyKingdom su GitHub e Vercel
# Verifica prerequisiti e prepara il repository

Write-Host "=== Deploy MyKingdom su GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Verifica Node.js
Write-Host "Verifica Node.js..." -ForegroundColor Yellow
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Host "ERRORE Node.js non trovato!" -ForegroundColor Red
    Write-Host "Installa Node.js da https://nodejs.org/ e riavvia PowerShell" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Vuoi aprire il sito di Node.js? (S/N)"
    if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
        Start-Process "https://nodejs.org/"
    }
    exit 1
}
Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green

# Verifica Git
Write-Host "Verifica Git..." -ForegroundColor Yellow
$gitVersion = $null
try {
    $gitVersion = git --version 2>$null
} catch {}

if (-not $gitVersion) {
    Write-Host "ERRORE Git non trovato!" -ForegroundColor Red
    Write-Host "Installa Git da https://git-scm.com/ e riavvia PowerShell" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Vuoi aprire il sito di Git? (S/N)"
    if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
        Start-Process "https://git-scm.com/"
    }
    exit 1
}
Write-Host "OK Git: $gitVersion" -ForegroundColor Green
Write-Host ""

# Installa dipendenze se necessario
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

# Inizializza Git se non esiste
if (-not (Test-Path ".git")) {
    Write-Host "Inizializzazione repository Git..." -ForegroundColor Yellow
    git init
    git branch -M main
    Write-Host "OK Repository Git inizializzato" -ForegroundColor Green
    Write-Host ""
}

# Aggiungi tutti i file
Write-Host "Aggiunta file al repository..." -ForegroundColor Yellow
git add .
Write-Host "OK File aggiunti" -ForegroundColor Green
Write-Host ""

# Controlla se ci sono modifiche da committare
$status = git status --porcelain
if ($status) {
    Write-Host "Creazione commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: MyKingdom game for Android and iPhone"
    Write-Host "OK Commit creato" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Nessuna modifica da committare" -ForegroundColor Yellow
    Write-Host ""
}

# Istruzioni per GitHub
Write-Host "=== Prossimi Passi ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Vai su https://github.com e crea un nuovo repository:" -ForegroundColor White
Write-Host "   - Nome: mykingdom (o quello che preferisci)" -ForegroundColor Gray
Write-Host "   - Visibilità: Public o Private" -ForegroundColor Gray
Write-Host "   - NON inizializzare con README, .gitignore o license" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Dopo aver creato il repository, esegui questi comandi:" -ForegroundColor White
Write-Host ""
Write-Host "   git remote add origin https://github.com/TUO-UTENTE/mykingdom.git" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "   (Sostituisci TUO-UTENTE con il tuo username GitHub)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Per deploy su Vercel:" -ForegroundColor White
Write-Host "   - Vai su https://vercel.com" -ForegroundColor Gray
Write-Host "   - Importa il repository da GitHub" -ForegroundColor Gray
Write-Host "   - Vercel rileverà automaticamente la configurazione" -ForegroundColor Gray
Write-Host ""
Write-Host "Vuoi che apra GitHub ora? (S/N)" -ForegroundColor Cyan
$response = Read-Host
if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
    Start-Process "https://github.com/new"
}
