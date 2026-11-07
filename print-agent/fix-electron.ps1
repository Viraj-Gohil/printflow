# PrintFlow Agent - Windows PowerShell Electron Repair Tool
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   PRINTFLOW AGENT - POWERSHELL ELECTRON REPAIR       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

# 1. Kill locked processes
Write-Host "`n[1/5] Terminating locked electron.exe instances..." -ForegroundColor Yellow
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "PrintFlow Agent" -Force -ErrorAction SilentlyContinue

# 2. Check path.txt and dist\electron.exe
$ElectronDir = Join-Path $CurrentDir "node_modules\electron"
$PathTxt = Join-Path $ElectronDir "path.txt"
$ExeFile = Join-Path $ElectronDir "dist\electron.exe"

# 3. If electron.exe already exists, ensure path.txt points to it
if (Test-Path $ExeFile) {
    Write-Host "[2/5] Found existing electron.exe binary at: $ExeFile" -ForegroundColor Green
    Set-Content -Path $PathTxt -Value "electron.exe" -NoNewline
    Write-Host "[3/5] Restored node_modules\electron\path.txt -> electron.exe" -ForegroundColor Green
} else {
    Write-Host "[2/5] Electron binary is missing. Purging corrupt cache and reinstalling..." -ForegroundColor Yellow
    
    # Clear corrupt zip cache
    $CachePath = Join-Path $env:LOCALAPPDATA "electron\Cache"
    if (Test-Path $CachePath) {
        Get-ChildItem -Path $CachePath -Filter "*.zip" | Where-Object { $_.Length -lt 70MB } | Remove-Item -Force -ErrorAction SilentlyContinue
    }

    # Run electron install.js
    $InstallScript = Join-Path $ElectronDir "install.js"
    if (Test-Path $InstallScript) {
        Write-Host "[3/5] Executing Electron native download & extraction..." -ForegroundColor Cyan
        & node $InstallScript
    }

    # If still missing, reinstall electron package via npm
    if (-not (Test-Path $ExeFile)) {
        Write-Host "[4/5] Running clean npm install for electron..." -ForegroundColor Yellow
        if (Test-Path $ElectronDir) {
            Remove-Item -Recurse -Force $ElectronDir -ErrorAction SilentlyContinue
        }
        npm install --save-dev electron@34.3.0
    }
}

# 4. Ensure path.txt exists
if ((Test-Path $ExeFile) -and (-not (Test-Path $PathTxt))) {
    Set-Content -Path $PathTxt -Value "electron.exe" -NoNewline
}

# 5. Final check
if (Test-Path $ExeFile) {
    Write-Host "`n======================================================" -ForegroundColor Green
    Write-Host " SUCCESS: Electron runtime is successfully fixed!" -ForegroundColor Green
    Write-Host " Binary: $ExeFile" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "`nYou can now launch PrintFlow Agent with:" -ForegroundColor White
    Write-Host "  npm start`n" -ForegroundColor Yellow
} else {
    Write-Host "`n[ERROR] Electron installation could not be completed." -ForegroundColor Red
    Write-Host "Please check your internet connection or temporarily disable Windows Defender real-time protection, then rerun this script." -ForegroundColor Red
}
