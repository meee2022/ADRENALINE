@echo off
cd /d "%~dp0"
title Adrenaline Bridge - Backfill June
node bridge.mjs backfill 2026-06-01 2026-06-30
echo.
echo Done. Press any key to close.
pause >nul
