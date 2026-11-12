@echo off
echo ===================================================
echo   Environmental Forensic Intelligence Platform
echo   Starting Backend and Frontend Servers...
echo ===================================================

cd /d "%~dp0"

echo [1/2] Starting Backend (FastAPI + Google Earth Engine)...
start "EFI Backend (Port 8000)" /D "%~dp0backend" cmd /k ".venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend (Vite + React)...
start "EFI Frontend (Port 5173)" /D "%~dp0frontend" cmd /k "npm run dev"

echo ===================================================
echo Both servers are launching!
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo ===================================================
