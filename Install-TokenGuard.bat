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
  "$target = 'Z:\TEST PROJECT\release\win-unpacked\TokenGuard.exe'; " ^
  "$shortcutDesktop = $ws.CreateShortcut((Join-Path $desktop 'TokenGuard.lnk')); " ^
  "$shortcutDesktop.TargetPath = $target; " ^
  "$shortcutDesktop.WorkingDirectory = 'Z:\TEST PROJECT'; " ^
  "$shortcutDesktop.Description = 'TokenGuard - AI Token Optimizer & MoE Suite'; " ^
  "$shortcutDesktop.IconLocation = $target + ',0'; " ^
  "$shortcutDesktop.Save(); " ^
  "$shortcutStart = $ws.CreateShortcut((Join-Path $startMenu 'TokenGuard.lnk')); " ^
  "$shortcutStart.TargetPath = $target; " ^
  "$shortcutStart.WorkingDirectory = 'Z:\TEST PROJECT'; " ^
  "$shortcutStart.Description = 'TokenGuard - AI Token Optimizer & MoE Suite'; " ^
  "$shortcutStart.IconLocation = $target + ',0'; " ^
  "$shortcutStart.Save(); " ^
  "Write-Host '✅ Created Native Windows Desktop Icon: TokenGuard' -ForegroundColor Green; " ^
  "Write-Host '✅ Created Start Menu Shortcut: TokenGuard' -ForegroundColor Green; "

echo.
echo =================================================================
echo   🎉 INSTALLATION COMPLETE! Starting Native Desktop Application...
echo =================================================================
start "" "Z:\TEST PROJECT\release\win-unpacked\TokenGuard.exe"
exit
