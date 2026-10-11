# One-click start: judge + desk + dashboard, and the FOMO Chrome if it is not up yet.
# Double-click start_desk.bat (it runs this). Add --shadow for log-only mode.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { Write-Host "No .venv folder here. Run the setup steps first."; Read-Host "Enter to close"; exit 1 }

# Optional: desk.env next to this file, one KEY=value per line (see desk.env.example).
# Loaded for these windows only. Never commit it: it holds your keys.
$envFile = Join-Path $PSScriptRoot "desk.env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not $line.TrimStart().StartsWith("#")) {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), "Process")
        }
    }
}

# Anything not already set in Windows is asked once and kept only for these windows.
function Need($name, $prompt) {
    if (-not [Environment]::GetEnvironmentVariable($name)) {
        [Environment]::SetEnvironmentVariable($name, (Read-Host $prompt), "Process")
    }
}
Need "TYPESAFE_API_KEY" "Jev key (starts with apikey_)"
Need "DESK_SECRET"      "Desk password (any text you like)"
Need "DESK_BANK_USD"    "Paper bank in USD (for example 5000)"
$env:JUDGE_URL = "http://127.0.0.1:8080/judge"

if ($env:TYPESAFE_API_KEY.Length -lt 40) {
    Write-Host "That Jev key looks too short ($($env:TYPESAFE_API_KEY.Length) characters). A real one is about 100."
    Read-Host "Enter to close"; exit 1
}

# FOMO needs a Chrome with the debug port open, logged in at fomo.family
$up = $false
try { Invoke-WebRequest "http://localhost:9222/json" -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch {}
if (-not $up) {
    if (Get-Process chrome -ErrorAction SilentlyContinue) {
        Write-Host "Chrome is already open without the debug port. Close ALL Chrome windows, then run this again."
        Read-Host "Enter to close"; exit 1
    }
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $chrome) { Write-Host "Chrome not found in the usual places."; Read-Host "Enter to close"; exit 1 }
    Start-Process $chrome -ArgumentList "--remote-debugging-port=9222", "--remote-allow-origins=http://localhost:9222", "--user-data-dir=$env:USERPROFILE\chrome-fomo", "https://fomo.family"
    Write-Host "Chrome started. Log in to fomo.family in it if asked."
    Start-Sleep 5
}

$mode = if ($args -contains "--shadow") { "" } else { "--paper" }
function Win($cmd) {
    Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList "-NoExit", "-Command", $cmd
}
Win "& '$py' -m uvicorn judge:app --host 127.0.0.1 --port 8080"
Start-Sleep 6
Win "& '$py' run.py $mode"
Win "& '$py' -m uvicorn dashboard:app --port 8090"
Start-Sleep 3
Start-Process "http://127.0.0.1:8090"
Write-Host "Started. Three windows opened: judge, desk, dashboard. Keep them open."
Start-Sleep 4
