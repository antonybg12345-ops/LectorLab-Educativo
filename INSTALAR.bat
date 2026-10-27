@echo off
cd /d "%~dp0"
title Instalar LectorLab
echo ========================================
echo   LectorLab - instalacion de dependencias
echo ========================================
echo.
call npm ci
if errorlevel 1 (
  echo.
  echo Hubo un problema. Verifica que Node.js este instalado y que tengas internet.
  pause
  exit /b 1
)
echo.
echo Instalacion completada.
echo Ahora ejecuta INICIAR.bat. CONFIGURAR.bat es opcional para habilitar IA.
pause
