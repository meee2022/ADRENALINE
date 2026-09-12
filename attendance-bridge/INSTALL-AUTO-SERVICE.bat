@echo off
setlocal
cd /d "%~dp0"
title Adrenaline Attendance Bridge - Permanent Auto Start

net session >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Please right-click this file and choose "Run as administrator".
  echo     This is required once to install the automatic watchdog.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed. Install Node.js LTS first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

echo Removing old Startup shortcut to avoid duplicate launches...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Join-Path ([Environment]::GetFolderPath('Startup')) 'AdrenalineBridge.lnk'; Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue"

echo Installing watchdog every 2 minutes...
schtasks /Create /F /TN "Adrenaline Attendance Bridge Watchdog" /SC MINUTE /MO 2 /RU SYSTEM /RL HIGHEST /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%~dp0bridge-watchdog.ps1\"" >nul
if errorlevel 1 goto :failed

echo Installing an additional startup check...
schtasks /Create /F /TN "Adrenaline Attendance Bridge Startup" /SC ONSTART /DELAY 0000:30 /RU SYSTEM /RL HIGHEST /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%~dp0bridge-watchdog.ps1\"" >nul
if errorlevel 1 goto :failed

echo Starting the bridge now...
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0bridge-watchdog.ps1"
timeout /t 4 /nobreak >nul

echo.
echo =====================================================
echo  SUCCESS: automatic attendance bridge is installed.
echo  Windows checks it every 2 minutes and after startup.
echo  You do not need to run the monthly pull every day.
echo =====================================================
echo.
if exist status.json type status.json
pause
exit /b 0

:failed
echo.
echo [!] Installation failed. Keep this window and send a photo of the error.
pause
exit /b 1
