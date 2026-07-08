@echo off
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
  echo   - To verify it is pulling:   حالة-الجسر.bat
  echo   - To start it now:           run-hidden.vbs
  echo   - To stop it:                إيقاف-الجسر.bat
)
echo.
pause
