@echo off
chcp 65001 >nul
title Adrenaline Bridge - Stop
echo جاري إيقاف الجسر...
taskkill /f /im node.exe >nul 2>nul
if errorlevel 1 ( echo الجسر مش شغّال أصلاً. ) else ( echo تم إيقاف الجسر. )
echo عشان تشغّله تاني: دبل كليك على run-hidden.vbs
echo.
pause
