@echo off
echo === Setup MyKingdom ===
echo.

echo Verifica Node.js...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo OK Node.js trovato!
    echo.
    echo Installazione dipendenze...
    call npm install
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo OK Setup completato!
        echo.
        echo Per avviare il progetto:
        echo   npm run start    - Avvia Expo (poi premi w per web, a per Android)
        echo   npm run web      - Avvia direttamente su web
        echo   npm run android  - Avvia su Android (richiede emulatore)
    ) else (
        echo ERRORE durante l'installazione delle dipendenze
        pause
        exit /b 1
    )
) else (
    echo ERRORE Node.js non trovato!
    echo.
    echo Per installare Node.js:
    echo 1. Vai su https://nodejs.org/
    echo 2. Scarica la versione LTS (Long Term Support)
    echo 3. Esegui il file .msi e completa l'installazione
    echo 4. Assicurati che "Add to PATH" sia selezionato durante l'installazione
    echo 5. Riavvia il terminale e riesegui questo script
    echo.
    set /p response="Vuoi aprire il sito di Node.js ora? (S/N): "
    if /i "%response%"=="S" (
        start https://nodejs.org/
    )
    pause
    exit /b 1
)

pause
