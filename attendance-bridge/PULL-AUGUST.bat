@echo off
setlocal
cd /d "%~dp0"
title Adrenaline Bridge - Pull Full August 2026

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

rem Never reconcile today before its work shifts are complete. Before September,
rem pull through yesterday; after August ends, pull the complete month to Aug 31.
for /f %%D in ('powershell -NoProfile -Command "$today=Get-Date; $monthEnd=Get-Date -Year 2026 -Month 8 -Day 31; $monthStart=Get-Date -Year 2026 -Month 8 -Day 1; if($today -gt $monthEnd){$end=$monthEnd}else{$end=$today.Date.AddDays(-1)}; if($end -lt $monthStart){exit 1}; Get-Date $end -Format yyyy-MM-dd"') do set "END_DATE=%%D"

if not defined END_DATE (
  echo No completed August days are available yet.
  pause
  exit /b 1
)

echo.
echo Pulling all completed August attendance from 2026-08-01 through %END_DATE%...
echo Existing records are updated safely and are not duplicated.
echo.
node bridge.mjs backfill 2026-08-01 %END_DATE%
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Pull did not finish successfully. Keep this window and send a photo.
) else (
  echo Full August backfill finished successfully through %END_DATE%.
)
echo Press any key to close.
pause >nul
exit /b %RESULT%
