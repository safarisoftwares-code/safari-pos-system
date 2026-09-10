from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import sqlite3
import os
from datetime import datetime

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")

@router.get("/summary")
async def tax_summary(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Today's tax
    today = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COALESCE(SUM(tax_amount), 0) FROM tax_ledger WHERE created_at LIKE ?", (today + "%",))
    today_tax = cursor.fetchone()[0]
    
    # This month
    month = datetime.now().strftime("%Y-%m")
    cursor.execute("SELECT COALESCE(SUM(tax_amount), 0) FROM tax_ledger WHERE created_at LIKE ?", (month + "%",))
    month_tax = cursor.fetchone()[0]
    
    # This year
    year = datetime.now().strftime("%Y")
    cursor.execute("SELECT COALESCE(SUM(tax_amount), 0) FROM tax_ledger WHERE created_at LIKE ?", (year + "%",))
    year_tax = cursor.fetchone()[0]
    
    # Total
    cursor.execute("SELECT COALESCE(SUM(tax_amount), 0) FROM tax_ledger")
    total_tax = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "today_tax": round(today_tax, 2),
        "month_tax": round(month_tax, 2),
        "year_tax": round(year_tax, 2),
        "total_tax": round(total_tax, 2)
    }

@router.get("/transactions")
async def tax_transactions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT receipt_no, created_at, product_name, quantity, unit_price, tax_rate, tax_amount, payment_method, cashier FROM tax_ledger ORDER BY id DESC LIMIT 100")
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "receipt_no": r[0],
            "date": r[1],
            "product": r[2],
            "quantity": r[3],
            "unit_price": r[4],
            "tax_rate": r[5],
            "tax_amount": r[6],
            "payment": r[7],
            "cashier": r[8]
        }
        for r in rows
    ]
