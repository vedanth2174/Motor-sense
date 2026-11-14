@echo off
title MotorSense Frontend
cd /d "%~dp0frontend"
echo ========================================================
echo   MotorSense Frontend Server (React + Vite)
echo ========================================================

if not exist "node_modules" (
    echo [1/2] Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo Error installing node dependencies.
        pause
        exit /b 1
    )
)

echo [2/2] Starting Vite dev server on http://localhost:5173 ...
call npm run dev
pause
