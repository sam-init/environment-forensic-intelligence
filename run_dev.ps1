# Environmental Forensic Intelligence Platform
# PowerShell Launcher Script for Local Dev

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Environmental Forensic Intelligence Platform" -ForegroundColor Green
Write-Host "  Starting Backend and Frontend Servers..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

Write-Host "`n[1/2] Starting Backend (FastAPI + Google Earth Engine)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Frontend (Vite + React)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "Both servers launched in separate windows!" -ForegroundColor Green
Write-Host "  Backend API:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Frontend App: http://localhost:5173" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
