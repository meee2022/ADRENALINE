@echo off
title Adrenaline Bridge - Stop
cd /d "%~dp0"
powershell -NoProfile -Command ^
  "$t = Get-CimInstance Win32_Process | Where-Object {" ^
  "  ($_.Name -eq 'wscript.exe' -and $_.CommandLine -like '*run-hidden.vbs*') -or" ^
  "  ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*run.bat*') -or" ^
  "  ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*bridge.mjs*') };" ^
  "if ($t) { $t | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }"
del /Q bridge.lock >nul 2>nul
echo Attendance Bridge stopped.
if /I "%~1"=="silent" exit /b 0
pause
