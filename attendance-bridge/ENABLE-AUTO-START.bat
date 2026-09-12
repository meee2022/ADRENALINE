@echo off
cd /d "%~dp0"
title Adrenaline Attendance Bridge - Auto Start

echo Creating Windows Startup shortcut for this folder...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\AdrenalineBridge.lnk');" ^
  "$lnk.TargetPath = 'wscript.exe';" ^
  "$lnk.Arguments = '\"%~dp0run-hidden.vbs\"';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.Description = 'Adrenaline Attendance Bridge';" ^
  "$lnk.Save()"

if errorlevel 1 (
  echo Failed to create the Startup shortcut.
  pause
  exit /b 1
)

echo Auto-start enabled successfully.
echo Starting the bridge hidden now...
start "" wscript.exe "%~dp0run-hidden.vbs"
echo Done. The bridge will also start automatically after Windows login.
pause
