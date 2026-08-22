Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "Z:\TEST PROJECT"
WshShell.Run "node dist/src/index.js", 0, False
WScript.Sleep 1000
WshShell.Run "msedge.exe --app=http://localhost:8080/dashboard --window-size=1120,820", 1, False
