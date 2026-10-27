@echo off
cd /d "%~dp0"
title LectorLab
echo ========================================
echo   Iniciando LectorLab
echo ========================================
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
npm start
pause
