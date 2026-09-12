@echo off
setlocal
cd /d "%~dp0"
title Adrenaline - Update Hikvision Person Names

net session >nul 2>nul
if errorlevel 1 (
  echo [!] Right-click this file and choose Run as administrator.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed.
  pause
  exit /b 1
)

echo Stopping attendance bridge briefly to avoid simultaneous device requests...
call STOP-BRIDGE.bat silent >nul 2>nul
title Adrenaline - Update Hikvision Person Names
timeout /t 4 /nobreak >nul

echo.
echo ==================== PREVIEW ====================
node update-person-names.mjs
if errorlevel 1 goto :failed

echo.
echo Type UPDATE and press Enter to apply only the displayed name changes.
echo Fingerprints, cards and Person IDs will stay unchanged.
set /p CONFIRM=Confirmation: 
if /I not "%CONFIRM%"=="UPDATE" goto :cancelled

echo.
echo ===================== APPLY =====================
node update-person-names.mjs --apply
if errorlevel 1 goto :failed

echo.
echo Restarting automatic attendance bridge...
call :restart_bridge
echo.
echo SUCCESS. Names were updated and verified on the device.
pause
exit /b 0

:cancelled
echo No changes were made.
call :restart_bridge
pause
exit /b 0

:failed
echo.
echo [!] Update stopped. Read the error above; existing fingerprints were not deleted.
call :restart_bridge
pause
exit /b 1

:restart_bridge
schtasks /Run /TN "Adrenaline Attendance Bridge Watchdog" >nul 2>nul
if errorlevel 1 echo The attendance bridge will restart automatically at its next scheduled check.
exit /b 0
