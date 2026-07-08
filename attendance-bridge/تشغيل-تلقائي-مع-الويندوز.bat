@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Adrenaline Bridge - Enable Auto Start

echo Enabling HIDDEN auto-start on Windows login...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\AdrenalineBridge.lnk');" ^
  "$lnk.TargetPath = 'wscript.exe';" ^
  "$lnk.Arguments = '\"%~dp0run-hidden.vbs\"';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.Description = 'Adrenaline Attendance Bridge';" ^
  "$lnk.Save()"

if errorlevel 1 (
  echo [!] Failed to enable auto-start.
) else (
  echo.
  echo [OK] Done. The bridge will now start automatically ^(HIDDEN, no window^)
  echo      every time this PC turns on / logs in.
  echo.
  echo   - To START it now:      double-click  run-hidden.vbs
  echo   - To VERIFY it pulls:   double-click  the STATUS file  (shows recent pulls)
  echo   - To STOP it:           double-click  the STOP file
)
echo.
pause
