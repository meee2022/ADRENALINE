@echo off
cd /d "%~dp0"
title Adrenaline Bridge - Device Check
where node >nul 2>nul
if errorlevel 1 ( echo [!] Install Node.js LTS from https://nodejs.org first. & pause & exit /b 1 )
if not exist node_modules ( call npm install )
node check.mjs
pause
