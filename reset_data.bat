@echo off
echo ========================================================
echo   MotorSense - Reset Telemetry and Start from Scratch
echo ========================================================
echo.
echo Clearing sensor readings, alerts, and resetting baseline status...

docker exec -i motorsense-postgres psql -U motor -d motorsense -c "TRUNCATE TABLE sensor_readings CASCADE; TRUNCATE TABLE alerts CASCADE; TRUNCATE TABLE ai_analyses CASCADE; UPDATE machines SET learning_status = 'COLLECTING_BASELINE'; UPDATE machine_baselines SET status = 'COLLECTING_BASELINE', sample_count = 0;"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Database readings and alerts cleared successfully!
    echo [OK] Machine MOTOR_001 reset to COLLECTING_BASELINE.
) else (
    echo [ERROR] Failed to connect to motorsense-postgres container. Make sure Docker is running!
)

echo.
echo Removing any previously trained ML models...
docker exec -i motorsense-backend rm -rf /models/MOTOR_001 2>nul
echo [OK] Clean slate ready!
echo.
echo Now refresh your dashboard at http://localhost:5173
pause
