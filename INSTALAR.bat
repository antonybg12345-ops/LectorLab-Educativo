@echo off
cd /d "%~dp0"
title Instalar LectorLab
echo ========================================
echo   LectorLab - instalacion de dependencias
echo ========================================
echo.
npm install
if errorlevel 1 (
  echo.
  echo Hubo un problema. Verifica que Node.js este instalado y que tengas internet.
  pause
  exit /b 1
)
echo.
echo Instalacion completada.
echo Ahora ejecuta CONFIGURAR.bat y luego INICIAR.bat
pause
