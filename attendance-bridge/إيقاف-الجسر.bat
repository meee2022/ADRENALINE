@echo off
title Adrenaline Bridge - Stop
cd /d "%~dp0"
echo Stopping the bridge (all parts)...
powershell -NoProfile -Command ^
  "$t = Get-CimInstance Win32_Process | Where-Object {" ^
  "  ($_.Name -eq 'wscript.exe' -and $_.CommandLine -like '*run-hidden.vbs*') -or" ^
  "  ($_.Name -eq 'cmd.exe'     -and $_.CommandLine -like '*run.bat*') -or" ^
  "  ($_.Name -eq 'node.exe'    -and $_.CommandLine -like '*bridge.mjs*') };" ^
  "if ($t) {" ^
  "  $t | Sort-Object { if ($_.Name -eq 'node.exe') {1} else {0} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue };" ^
  "  Write-Host 'Bridge stopped.' } else { Write-Host 'Bridge was not running.' }"
del /q bridge.lock >nul 2>nul
echo.
echo To start it again: double-click  run-hidden.vbs
echo.
pause
