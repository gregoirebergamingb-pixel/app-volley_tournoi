@echo off
REM Fichier pour arrêter l'application Volleyball Tournament Manager

echo.
echo ====================================
echo 🛑 Arrêt de l'application
echo ====================================
echo.

REM Tuer les processus Node.js
echo Fermeture des serveurs...
taskkill /IM node.exe /F

echo.
echo ✅ Application arrêtée!
echo.

pause
