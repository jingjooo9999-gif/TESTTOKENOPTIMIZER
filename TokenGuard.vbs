Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "Z:\TEST PROJECT"
WshShell.Run """Z:\TEST PROJECT\release\win-unpacked\TokenGuard.exe""", 1, False
