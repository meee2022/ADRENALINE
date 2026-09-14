@echo off
setlocal
cd /d "%~dp0"
title Adrenaline Bridge - Repair attendance since 2026-08-25

rem Repairs the "check-in = check-out (0 hrs)" rows created between 2026-08-25 and
rem yesterday by re-pulling every full day from the device. Full-day pulls replace
rem the stored rows, so the corrected server rebuilds each day from all its punches.
rem Run it on the restaurant PC (the device is only reachable there), AFTER the
rem server fix is deployed, and with the automatic bridge stopped (STOP-BRIDGE.bat).

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
    pause
    exit /b 1
  )
)

rem Never reconcile today before its work shifts are complete: pull through yesterday.
for /f %%D in ('powershell -NoProfile -Command "Get-Date (Get-Date).Date.AddDays(-1) -Format yyyy-MM-dd"') do set "END_DATE=%%D"

if not defined END_DATE (
  echo Could not compute yesterday's date.
  pause
  exit /b 1
)

echo.
echo Repairing attendance from 2026-08-25 through %END_DATE%...
echo Every day is rebuilt from all of its punches. Manual corrections are kept.
echo.
node bridge.mjs backfill 2026-08-25 %END_DATE%
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Repair did not finish successfully. Keep this window and send a photo.
) else (
  echo Repair finished successfully through %END_DATE%.
  echo Now start the automatic bridge again (run.bat or ENABLE-AUTO-START.bat).
)
echo Press any key to close.
pause >nul
exit /b %RESULT%
