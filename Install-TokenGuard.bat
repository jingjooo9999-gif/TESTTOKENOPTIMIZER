@echo off
title Installing TokenGuard Desktop...
echo =================================================================
echo   🛡️  INSTALLING TOKENGUARD DESKTOP APPLICATION ON YOUR PC
echo =================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$startMenu = [Environment]::GetFolderPath('Programs'); " ^
  "$target = 'Z:\TEST PROJECT\TokenGuard.vbs'; " ^
  "$shortcutDesktop = $ws.CreateShortcut((Join-Path $desktop 'TokenGuard.lnk')); " ^
  "$shortcutDesktop.TargetPath = 'wscript.exe'; " ^
  "$shortcutDesktop.Arguments = '\"' + $target + '\"'; " ^
  "$shortcutDesktop.WorkingDirectory = 'Z:\TEST PROJECT'; " ^
  "$shortcutDesktop.Description = 'TokenGuard - AI Token Optimizer'; " ^
  "$shortcutDesktop.Save(); " ^
  "$shortcutStart = $ws.CreateShortcut((Join-Path $startMenu 'TokenGuard.lnk')); " ^
  "$shortcutStart.TargetPath = 'wscript.exe'; " ^
  "$shortcutStart.Arguments = '\"' + $target + '\"'; " ^
  "$shortcutStart.WorkingDirectory = 'Z:\TEST PROJECT'; " ^
  "$shortcutStart.Description = 'TokenGuard - AI Token Optimizer'; " ^
  "$shortcutStart.Save(); " ^
  "Write-Host '✅ Created Desktop Icon: TokenGuard' -ForegroundColor Green; " ^
  "Write-Host '✅ Created Start Menu Shortcut: TokenGuard' -ForegroundColor Green; "

echo.
echo =================================================================
echo   🎉 INSTALLATION COMPLETE! Starting TokenGuard Desktop App...
echo =================================================================
wscript.exe "Z:\TEST PROJECT\TokenGuard.vbs"
exit
