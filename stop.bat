@echo off
echo.
echo Arret de l'application...

REM Tuer les processus Node.js
taskkill /IM node.exe /F >nul 2>&1

REM Fermer les fenetres CMD ouvertes par run.bat
taskkill /FI "WINDOWTITLE eq Backend - Volleyball Tournament App" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend - Volleyball Tournament App" /F >nul 2>&1

echo Application arretee !
echo.
timeout /t 2 /nobreak >nul
