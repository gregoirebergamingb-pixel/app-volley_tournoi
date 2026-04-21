@echo off
REM Fichier pour lancer l'application Volleyball Tournament Manager
REM Double-cliquez sur ce fichier pour démarrer l'application

echo.
echo ====================================
echo   Volleyball Tournament Manager
echo ====================================
echo.

REM Vérifier que Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERREUR: Node.js n'est pas installé!
    echo Téléchargez Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detecte
echo.

REM Obtenir le répertoire du script
set SCRIPT_DIR=%~dp0

REM Lancer le backend dans une nouvelle fenêtre
echo Lancement du backend...
start "Backend - Volleyball Tournament App" cmd /k "cd /d "%SCRIPT_DIR%backend" && npm start"

REM Attendre 5 secondes pour que le backend démarre
timeout /t 5 /nobreak

REM Lancer le frontend dans une nouvelle fenêtre
echo Lancement du frontend...
start "Frontend - Volleyball Tournament App" cmd /k "cd /d "%SCRIPT_DIR%frontend" && SET BROWSER=none && npm start"

REM Attendre 10 secondes pour que le frontend démarre
timeout /t 10 /nobreak

REM Ouvrir le navigateur
echo Ouverture du navigateur...
start http://localhost:3000

echo.
echo ====================================
echo Application lancee!
echo.
echo Adresses:
echo   - Frontend:  http://localhost:3000
echo   - Backend:   http://localhost:5000
echo.
echo Les deux fenetres de terminal resteront ouvertes.
echo Fermer une fenetre arrêtera le serveur correspondant.
echo ====================================
echo.

pause
