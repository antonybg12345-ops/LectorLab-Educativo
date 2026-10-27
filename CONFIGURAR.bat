@echo off
cd /d "%~dp0"
title Configurar LectorLab
if not exist .env copy .env.example .env >nul
echo Se abrira el archivo .env en Bloc de notas.
echo Pega tu clave despues de OPENAI_API_KEY=
echo Guarda el archivo y cierralo.
echo.
start "" notepad .env
pause
