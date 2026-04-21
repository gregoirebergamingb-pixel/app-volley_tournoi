@echo off
REM Fichier pour arrêter l'application Volleyball Tournament Manager

echo.
echo ====================================
echo Arret de l'application
echo ====================================
echo.

REM Tuer les processus Node.js
echo Fermeture des serveurs...
taskkill /IM node.exe /F

echo.
echo  Application arretee!
echo.

pause
