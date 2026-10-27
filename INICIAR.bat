@echo off
cd /d "%~dp0"
title LectorLab
echo ========================================
echo   Iniciando LectorLab
echo ========================================
echo.
echo Abre la direccion indicada cuando el servidor termine de iniciar.
call npm start
pause
