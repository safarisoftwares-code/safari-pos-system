@echo off
title Safari POS System
echo ========================================
echo   SAFARI POS SYSTEM
echo   Folksmed Suppliers
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Safari POS Server...
start /min cmd /c "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

echo Opening Safari POS in browser...
start http://localhost:8000

echo.
echo Safari POS is running!
echo Keep this window open while using the system.
echo.
pause
