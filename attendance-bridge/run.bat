@echo off
cd /d "%~dp0"
title Adrenaline Attendance Bridge
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo Starting bridge... keep this window open.
node bridge.mjs
pause
