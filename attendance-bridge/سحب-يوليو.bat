@echo off
cd /d "%~dp0"
title Adrenaline Bridge - Backfill July + August
node bridge.mjs backfill 2026-07-01 2026-08-15
echo.
echo Done. Press any key to close.
pause >nul
