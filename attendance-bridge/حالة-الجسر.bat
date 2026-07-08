@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Adrenaline Bridge - Status
echo ==================  حالة جسر البصمة  ==================
echo.
if exist status.json (
  echo [ آخر حالة مسجّلة ]
  type status.json
) else (
  echo لسه مفيش حالة مسجّلة - يعني الجسر ماشتغلش لسه.
)
echo.
echo --------  آخر 15 سطر من السجل  --------
if exist bridge.log (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'bridge.log' -Tail 15 -Encoding UTF8"
) else (
  echo لسه مفيش سجل bridge.log
)
echo.
echo ملاحظة: لو آخر وقت في السجل قريب من دلوقتي = الجسر شغّال وبيسحب فعليًا.
echo         لو آخر وقت من ساعات = الجسر واقف (شغّله من run-hidden.vbs او run.bat).
echo.
pause
