@echo off
title MotorSense Backend
cd /d "%~dp0backend"
echo ========================================================
echo   MotorSense Backend Server (FastAPI)
echo ========================================================

if not exist "venv\Scripts\activate.bat" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Error creating virtual environment. Please check Python installation.
        pause
        exit /b 1
    )
)

echo [2/3] Activating venv and checking dependencies...
call venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo Error installing dependencies.
    pause
    exit /b 1
)

echo [3/3] Setting local environment variables...
set DATABASE_URL=sqlite:///./motor_data.db
set AUTH_ENABLED=false
set MODEL_DIR=./models
set LLM_PROVIDER=none
set CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8443,http://localhost:3000

echo ========================================================
echo   Backend is starting at http://localhost:8005
echo   API Docs available at http://localhost:8005/docs
echo ========================================================
python -m uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload
pause
