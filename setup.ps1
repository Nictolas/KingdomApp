# Script di setup per MyKingdom
# Verifica e guida l'installazione di Node.js

Write-Host "=== Setup MyKingdom ===" -ForegroundColor Cyan
Write-Host ""

# Verifica Node.js
Write-Host "Verifica Node.js..." -ForegroundColor Yellow

$nodeVersion = $null
$npmVersion = $null

try {
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null
} catch {
    # Ignora errori
}

if ($nodeVersion -and $npmVersion) {
    Write-Host "OK Node.js installato: $nodeVersion" -ForegroundColor Green
    Write-Host "OK npm installato: $npmVersion" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Installazione dipendenze..." -ForegroundColor Yellow
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "OK Setup completato!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Per avviare il progetto:" -ForegroundColor Cyan
        Write-Host "  npm run start    - Avvia Expo (poi premi w per web, a per Android)" -ForegroundColor White
        Write-Host "  npm run web      - Avvia direttamente su web" -ForegroundColor White
        Write-Host "  npm run android  - Avvia su Android (richiede emulatore)" -ForegroundColor White
    } else {
        Write-Host "ERRORE durante l'installazione delle dipendenze" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ERRORE Node.js non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Per installare Node.js:" -ForegroundColor Yellow
    Write-Host "1. Vai su https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Scarica la versione LTS (Long Term Support)" -ForegroundColor White
    Write-Host "3. Esegui il file .msi e completa l'installazione" -ForegroundColor White
    Write-Host "4. Assicurati che Add to PATH sia selezionato durante l'installazione" -ForegroundColor White
    Write-Host "5. Riavvia PowerShell e riesegui questo script" -ForegroundColor White
    Write-Host ""
    Write-Host "Vuoi aprire il sito di Node.js ora? (S/N)" -ForegroundColor Cyan
    $response = Read-Host
    if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
        Start-Process "https://nodejs.org/"
    }
    exit 1
}
