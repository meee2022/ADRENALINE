@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Adrenaline Bridge - Status
echo ==================  BRIDGE STATUS  ==================
echo.
if exist status.json (
  echo [ Last status ]
  type status.json
) else (
  echo No status yet - the bridge has not run.
)
echo.
echo --------  Last 15 log lines  --------
if exist bridge.log (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'bridge.log' -Tail 15 -Encoding UTF8"
) else (
  echo No bridge.log yet.
)
echo.
echo NOTE: if the last time above is close to NOW  = bridge is running and pulling.
echo       if the last time is hours ago          = bridge is stopped (run run-hidden.vbs).
echo.
pause
