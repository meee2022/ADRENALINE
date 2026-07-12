@echo off
rem ============================================================
rem  Adrenaline — شاشة متابعة طلبات الأونلاين الموحّدة
rem  يفتح لوحات (سنونو + طلبات + رفيق) مرتّبة على شاشة واحدة.
rem  أول مرة: سجّل دخولك في كل نافذة — الجلسات تتحفظ في بروفايل
rem  خاص (orders-wallboard) فما تحتاجش تسجّل كل مرة.
rem ============================================================

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

set PROFILE=%LOCALAPPDATA%\AdrenalineWallboard

rem --- الشاشة تتقسم 3 أعمدة (مضبوطة لشاشتك 1920x1200)
start "" %CHROME% --user-data-dir="%PROFILE%\snoonu"  --app=https://merchant.snoonu.com/dashboard/order --window-position=0,0    --window-size=640,1150
start "" %CHROME% --user-data-dir="%PROFILE%\talabat" --app=https://partner-app.talabat.com/live-orders --window-position=640,0  --window-size=640,1150
start "" %CHROME% --user-data-dir="%PROFILE%\rafeeq"  --app=https://partner.gorafeeq.com/#/dashboard    --window-position=1280,0 --window-size=640,1150

exit
