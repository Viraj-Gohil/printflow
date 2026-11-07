@echo off
title PrintFlow Agent - Electron Repair Tool
echo ======================================================
echo    PRINTFLOW AGENT - AUTOMATED ELECTRON REPAIR
echo ======================================================
echo.

cd /d "%~dp0"

echo [1/4] Terminating any locked electron processes...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM "PrintFlow Agent.exe" /T >nul 2>&1

echo [2/4] Running automated Node.js repair script...
node scripts\fix-electron.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [3/4] Running forced Electron clean install...
    if exist node_modules\electron rmdir /s /q node_modules\electron
    call npm install --save-dev electron@34.3.0
    node scripts\ensure-electron.mjs
)

echo.
echo ======================================================
echo Repair completed. Try running:
echo   npm start
echo ======================================================
pause
