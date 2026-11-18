Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MotorSense - Reset Telemetry and Start from Scratch   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Clearing sensor readings, alerts, and resetting baseline status..." -ForegroundColor Yellow
docker exec -i motorsense-postgres psql -U motor -d motorsense -c "TRUNCATE TABLE sensor_readings CASCADE; TRUNCATE TABLE alerts CASCADE; TRUNCATE TABLE ai_analyses CASCADE; UPDATE machines SET learning_status = 'COLLECTING_BASELINE'; UPDATE machine_baselines SET status = 'COLLECTING_BASELINE', sample_count = 0;"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Database readings and alerts cleared successfully!" -ForegroundColor Green
    Write-Host "[OK] Machine MOTOR_001 reset to COLLECTING_BASELINE." -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to connect to motorsense-postgres container. Make sure Docker is running!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Removing any previously trained ML models..." -ForegroundColor Yellow
docker exec -i motorsense-backend rm -rf /models/MOTOR_001
Write-Host "[OK] Clean slate ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Now refresh your dashboard at http://localhost:5173" -ForegroundColor Cyan
