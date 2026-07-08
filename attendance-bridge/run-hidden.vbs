' يشغّل الجسر مخفي تمامًا (بدون أي شباك) — بيسجّل كل حاجة في bridge.log
Dim fso, shell, here
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = here
' 0 = نافذة مخفية ، False = ميستناش
shell.Run """" & here & "\run.bat""", 0, False
