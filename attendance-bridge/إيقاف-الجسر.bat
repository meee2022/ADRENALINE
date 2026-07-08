@echo off
title Adrenaline Bridge - Stop
echo Stopping the bridge...
taskkill /f /im node.exe >nul 2>nul
if errorlevel 1 ( echo Bridge was not running. ) else ( echo Bridge stopped. )
echo To start it again: double-click  run-hidden.vbs
echo.
pause
