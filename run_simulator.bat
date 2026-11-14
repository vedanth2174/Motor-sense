@echo off
title MotorSense Telemetry Simulator
cd /d "%~dp0"
echo ========================================================
echo   MotorSense Telemetry Simulator
echo ========================================================
echo.
echo Select an action:
echo   1. Seed 520 Baseline Readings (Required for ML Training)
echo   2. Stream Healthy Readings (Every 3s)
echo   3. Inject Overcurrent Fault (Current ^> 9.35A)
echo   4. Inject Overheat Fault (Temperature ^> 80C)
echo   5. Inject High Vibration Fault (Vibration ^> 4.5 m/s2)
echo.
set /p choice="Enter choice [1-5]: "

if "%choice%"=="1" (
    echo Seeding baseline readings...
    python simulator/simulate.py --seed-baseline
) else if "%choice%"=="2" (
    echo Streaming healthy telemetry...
    python simulator/simulate.py --mode healthy --interval 3
) else if "%choice%"=="3" (
    echo Injecting overcurrent fault...
    python simulator/simulate.py --mode overcurrent --interval 2
) else if "%choice%"=="4" (
    echo Injecting overheat fault...
    python simulator/simulate.py --mode overheat --interval 2
) else if "%choice%"=="5" (
    echo Injecting vibration fault...
    python simulator/simulate.py --mode vibration --interval 2
) else (
    echo Invalid choice.
)

pause
