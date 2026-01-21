# Script per aprire i siti di download dei prerequisiti

Write-Host "=== Installazione Prerequisiti MyKingdom ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Apertura siti di download..." -ForegroundColor Yellow
Write-Host ""

# Apri Node.js
Write-Host "1. Node.js LTS..." -ForegroundColor White
Start-Process "https://nodejs.org/"
Start-Sleep -Seconds 2

# Apri Git
Write-Host "2. Git for Windows..." -ForegroundColor White
Start-Process "https://git-scm.com/download/win"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Istruzioni ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Installa Node.js:" -ForegroundColor White
Write-Host "   - Scarica la versione LTS (quella verde)" -ForegroundColor Gray
Write-Host "   - Esegui il file .msi" -ForegroundColor Gray
Write-Host "   - Assicurati che 'Add to PATH' sia selezionato" -ForegroundColor Gray
Write-Host "   - Completa l'installazione" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Installa Git:" -ForegroundColor White
Write-Host "   - Scarica Git for Windows" -ForegroundColor Gray
Write-Host "   - Esegui il file .exe" -ForegroundColor Gray
Write-Host "   - Usa le impostazioni predefinite (va bene tutto)" -ForegroundColor Gray
Write-Host "   - Completa l'installazione" -ForegroundColor Gray
Write-Host ""
Write-Host "3. DOPO l'installazione:" -ForegroundColor Yellow
Write-Host "   - CHIUDI e RIAPRI PowerShell" -ForegroundColor Yellow
Write-Host "   - Esegui: .\deploy-github.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "I siti sono stati aperti nel browser!" -ForegroundColor Green
Write-Host ""
