@echo off
title MotorSense Report PDF Generator
cd /d "%~dp0docs"
echo ========================================================
echo   Generating MotorSense Project Report PDF
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0docs\export_report_pdf.ps1"
echo.
pause
