@echo off
echo ========================================
echo   SAFARI POS SYSTEM
echo   Safari Softwares
echo ========================================
echo.
cd /d "%~dp0"

echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.9+
    pause
    exit /b 1
)

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting Safari POS...
echo Access: http://localhost:8000
echo.

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
