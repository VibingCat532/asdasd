# setup-and-build.ps1
# Usage: run this after installing Node.js/npm (or using nvm-windows to install Node 24.x)
# PowerShell: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\scripts\setup-and-build.ps1

function Check-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  return $null -ne $cmd
}

if (-not (Check-Command node)) {
  Write-Host "Node.js is not installed or not on PATH. Install Node 24.x or use nvm-windows and re-run this script." -ForegroundColor Red
  exit 2
}

if (-not (Check-Command npm)) {
  Write-Host "npm is not installed or not on PATH. Ensure Node.js installation includes npm." -ForegroundColor Red
  exit 2
}

Write-Host "Node version:" -NoNewline; node -v
Write-Host "npm version:" -NoNewline; npm -v

# Frontend build
Push-Location "$(Resolve-Path ..\frontend)"
try {
  Write-Host "Installing frontend dependencies..."
  npm ci --no-audit --no-fund
  Write-Host "Building frontend..."
  npm run build
  Write-Host "Frontend build finished. Output in ./build"
} catch {
  Write-Host "Frontend build failed: $_" -ForegroundColor Red
  Pop-Location
  exit 3
}
Pop-Location

# Backend install
Push-Location "$(Resolve-Path ..\backend-node)"
try {
  Write-Host "Installing backend dependencies..."
  npm ci --no-audit --no-fund
  Write-Host "Backend dependencies installed. To start backend run: npm start (in a separate terminal)"
} catch {
  Write-Host "Backend install failed: $_" -ForegroundColor Red
  Pop-Location
  exit 4
}
Pop-Location

Write-Host "Gotowe. Jeśli chcesz uruchomić backend teraz, otwórz nowy terminal i uruchom:"
Write-Host "cd d:\\Backup\\asdasd\\backend-node" -ForegroundColor Cyan
Write-Host "npm start" -ForegroundColor Cyan

Write-Host "Uwaga: backend może wymagać ustawienia zmiennych środowiskowych (DATABASE_URL, DISCORD_BOT_TOKEN itp.)." -ForegroundColor Yellow

exit 0
