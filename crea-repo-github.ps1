# Script per creare automaticamente la repository su GitHub
# Usa l'API REST di GitHub

Write-Host "=== Crea Repository GitHub per MyKingdom ===" -ForegroundColor Cyan
Write-Host ""

# Verifica Git
$gitVersion = $null
try {
    $gitVersion = git --version 2>$null
} catch {}

if (-not $gitVersion) {
    Write-Host "ERRORE Git non trovato!" -ForegroundColor Red
    Write-Host "Installa Git da https://git-scm.com/ e riavvia PowerShell" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK Git installato" -ForegroundColor Green
Write-Host ""

# Chiedi informazioni
Write-Host "Per creare la repository su GitHub, mi serve:" -ForegroundColor Yellow
Write-Host ""

# Nome repository
$repoName = Read-Host "Nome repository (default: mykingdom)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "mykingdom"
}

# Visibilità
Write-Host ""
Write-Host "Visibilità repository:" -ForegroundColor Yellow
Write-Host "1. Public (visibile a tutti)" -ForegroundColor White
Write-Host "2. Private (solo tu)" -ForegroundColor White
$visibility = Read-Host "Scegli (1 o 2, default: 1)"
if ($visibility -ne "2") {
    $isPrivate = $false
} else {
    $isPrivate = $true
}

# Username GitHub
Write-Host ""
$username = Read-Host "Username GitHub"

# Personal Access Token
Write-Host ""
Write-Host "Personal Access Token GitHub:" -ForegroundColor Yellow
Write-Host "Se non ce l'hai, crealo qui: https://github.com/settings/tokens/new" -ForegroundColor Gray
Write-Host "Permessi necessari: 'repo' (tutti i permessi repo)" -ForegroundColor Gray
Write-Host ""
$token = Read-Host "Incolla il token" -AsSecureString
$tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
)

if ([string]::IsNullOrWhiteSpace($tokenPlain) -or [string]::IsNullOrWhiteSpace($username)) {
    Write-Host "ERRORE Username e token sono obbligatori!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Creazione repository su GitHub..." -ForegroundColor Yellow

# Crea la repository via API
$body = @{
    name = $repoName
    description = "MyKingdom - Gioco per Android e iPhone con Expo + React Native"
    private = $isPrivate
    auto_init = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $tokenPlain"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "MyKingdom-Setup"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Body $body -Headers $headers -ContentType "application/json"
    
    Write-Host "OK Repository creata con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "URL: $($response.html_url)" -ForegroundColor Cyan
    Write-Host "Clone URL: $($response.clone_url)" -ForegroundColor Cyan
    Write-Host ""
    
    # Apri il browser
    Start-Process $response.html_url
    
    # Prepara il repository locale
    Write-Host "Preparazione repository locale..." -ForegroundColor Yellow
    
    if (-not (Test-Path ".git")) {
        git init
        git branch -M main
    }
    
    # Rimuovi remote esistente se c'è
    $existingRemote = git remote get-url origin 2>$null
    if ($existingRemote) {
        git remote remove origin
    }
    
    # Aggiungi remote
    git remote add origin $response.clone_url
    Write-Host "OK Remote aggiunto" -ForegroundColor Green
    
    # Aggiungi file
    Write-Host "Aggiunta file..." -ForegroundColor Yellow
    git add .
    
    # Commit
    $status = git status --porcelain
    if ($status) {
        git commit -m "Initial commit: MyKingdom game for Android and iPhone"
        Write-Host "OK Commit creato" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=== Push su GitHub ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Eseguendo push..." -ForegroundColor Yellow
    
    # Push (usa il token come password)
    $env:GIT_TERMINAL_PROMPT = "0"
    $remoteUrl = $response.clone_url -replace "https://", "https://$tokenPlain@"
    git push -u origin main 2>&1 | Out-String
    
    Write-Host ""
    Write-Host "OK Push completato!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository disponibile su: $($response.html_url)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Per deploy su Vercel:" -ForegroundColor Yellow
    Write-Host "1. Vai su https://vercel.com" -ForegroundColor White
    Write-Host "2. Importa il repository: $repoName" -ForegroundColor White
    Write-Host "3. Vercel rileverà automaticamente la configurazione" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERRORE durante la creazione della repository!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Messaggio: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Dettagli: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "- Token non valido o scaduto" -ForegroundColor White
    Write-Host "- Token senza permessi 'repo'" -ForegroundColor White
    Write-Host "- Nome repository già esistente" -ForegroundColor White
    Write-Host "- Problemi di connessione" -ForegroundColor White
    exit 1
}
