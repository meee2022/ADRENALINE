@echo off
setlocal
cd /d "%~dp0"
title Adrenaline Bridge - Pull July 2026

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo.
echo Pulling attendance from 2026-07-01 through 2026-07-31...
echo Existing records are updated safely and are not duplicated.
echo.
node bridge.mjs backfill 2026-07-01 2026-07-31
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Pull did not finish successfully. Read the message above, keep this
  echo window open, and send a photo of it.
) else (
  echo July backfill finished successfully.
)
echo Press any key to close.
pause >nul
exit /b %RESULT%
