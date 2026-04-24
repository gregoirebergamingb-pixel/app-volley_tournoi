@echo off
echo.
echo Arret de l'application...

REM Tuer les processus Node.js
taskkill /IM node.exe /F >nul 2>&1

REM Fermer toutes les fenetres CMD
taskkill /IM cmd.exe /F >nul 2>&1

echo Application arretee !
echo.
timeout /t 2 /nobreak >nul
