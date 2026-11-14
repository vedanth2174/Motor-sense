@echo off
title MotorSense Master Launcher
cd /d "%~dp0"

echo ========================================================
echo   Launching MotorSense Full Stack
echo ========================================================
echo.
echo [1/3] Launching Backend Server (port 8005)...
start "MotorSense Backend" cmd /k "cd /d "%~dp0" && start_backend.bat"

echo [2/3] Launching Frontend Server (port 5173)...
start "MotorSense Frontend" cmd /k "cd /d "%~dp0" && start_frontend.bat"

echo [3/3] Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo   MotorSense is running!
echo   - Backend:  http://localhost:8005
echo   - Frontend: http://localhost:5173
echo.
echo   To feed data: run simulator\simulate.py or run_simulator.bat
echo ========================================================
echo.
pause
