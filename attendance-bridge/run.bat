@echo off
cd /d "%~dp0"
title Adrenaline Attendance Bridge

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js is NOT installed on this PC.
  echo     Install Node.js LTS from https://nodejs.org  then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies for the first time...
  call npm install
)

:loop
echo ==================================================
echo   ADRENALINE ATTENDANCE BRIDGE - running
echo   %date% %time%
echo   Keep this window open. Pulls attendance every few minutes.
echo ==================================================
node bridge.mjs
REM exit code 0 = another instance already running (or clean stop) -> do NOT restart
if not errorlevel 1 (
  echo Another instance is already running, or stopped cleanly. Exiting.
  exit /b 0
)
echo.
echo [!] Bridge crashed (network/error). Restarting in 15s... (close window to quit)
timeout /t 15 /nobreak >nul
goto loop
