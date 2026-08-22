@echo off
title TokenGuard Desktop
cd /d "%~dp0"
start "" msedge.exe --app=http://localhost:8080/dashboard --window-size=1100,800
exit
