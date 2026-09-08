@echo off
title Safari POS
color 0A
echo.
echo  ========================================
echo    SAFARI POS SYSTEM
echo    Folksmed Suppliers
echo  ========================================
echo.
echo  Starting server...
echo.
cd /d "C:\Users\HomePC\safari-pos\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
