@echo off
cd /d "%~dp0"
title Adrenaline Bridge - Enable Auto Start

echo Enabling auto-start on Windows login...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\AdrenalineBridge.lnk');" ^
  "$lnk.TargetPath = '%~dp0run.bat';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.WindowStyle = 7;" ^
  "$lnk.Description = 'Adrenaline Attendance Bridge';" ^
  "$lnk.Save()"

if errorlevel 1 (
  echo [!] Failed to enable auto-start.
) else (
  echo.
  echo [OK] Done. The bridge will now start automatically every time
  echo      this PC logs in (runs minimized in the taskbar).
  echo.
  echo To start it right now without restarting, just run  run.bat
)
echo.
pause
