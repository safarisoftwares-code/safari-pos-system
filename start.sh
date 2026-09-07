#!/bin/bash
echo "========================================"
echo "  SAFARI POS SYSTEM"
echo "  Safari Softwares"
echo "========================================"
echo ""
cd ""

echo "Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "Starting Safari POS..."
echo "Access: http://localhost:8000"
echo ""

cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
