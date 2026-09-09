from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import Product
import sqlite3
import os

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")

def get_setting(key):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None

def set_setting(key, value):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

@router.get("/")
async def get_settings(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # ANY authenticated user can READ settings (needed for receipt)
    return {
        "default_tax_rate": float(get_setting("default_tax_rate") or 16),
        "business_name": get_setting("business_name") or "My Business",
        "business_po_box": get_setting("business_po_box") or "",
        "business_location": get_setting("business_location") or "",
        "business_phone": get_setting("business_phone") or "",
        "business_tax_pin": get_setting("business_tax_pin") or "",
        "receipt_footer": get_setting("receipt_footer") or "Thank you! Karibu Tena!",
        "mpesa_enabled": get_setting("mpesa_enabled") or "false",
        "mpesa_consumer_key": get_setting("mpesa_consumer_key") or "",
        "mpesa_consumer_secret": get_setting("mpesa_consumer_secret") or "",
        "mpesa_passkey": get_setting("mpesa_passkey") or "",
        "mpesa_shortcode": get_setting("mpesa_shortcode") or "",
        "block_expired": get_setting("block_expired") or "false",
        "backup_location": get_setting("backup_location") or "",
        "warn_expiring": get_setting("warn_expiring") or "false"
    }

@router.put("/tax-rate")
async def update_tax_rate(rate: float, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Only admin can update
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update tax rate")
    
    set_setting("default_tax_rate", str(rate))
    
    products = db.query(Product).all()
    for product in products:
        product.tax_rate = rate
    
    db.commit()
    return {"message": "Tax rate updated"}

@router.put("/business")
async def update_business_info(data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Only admin can update
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update settings")
    
    if "business_name" in data:
        set_setting("business_name", data["business_name"])
    if "business_po_box" in data:
        set_setting("business_po_box", data["business_po_box"])
    if "business_location" in data:
        set_setting("business_location", data["business_location"])
    if "business_phone" in data:
        set_setting("business_phone", data["business_phone"])
    if "business_tax_pin" in data:
        set_setting("business_tax_pin", data["business_tax_pin"])
    if "receipt_footer" in data:
        set_setting("receipt_footer", data["receipt_footer"])
    
    if "block_expired" in data:
        set_setting("block_expired", data["block_expired"])
    if "backup_location" in data:
        set_setting("backup_location", data["backup_location"])
    if "warn_expiring" in data:
        set_setting("warn_expiring", data["warn_expiring"])
    
    return {"message": "Settings updated"}