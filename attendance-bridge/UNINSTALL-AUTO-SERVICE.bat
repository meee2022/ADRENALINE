@echo off
schtasks /Delete /F /TN "Adrenaline Attendance Bridge Watchdog" >nul 2>nul
schtasks /Delete /F /TN "Adrenaline Attendance Bridge Startup" >nul 2>nul
echo Automatic attendance bridge tasks removed.
pause
