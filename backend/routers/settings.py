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

@router.post("/reset-demo")
async def reset_demo_data(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Reset all demo data - keeps admin user and settings"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can reset demo data")
    
    import sqlite3
    import shutil
    from datetime import datetime
    
    # Create safety backup first
    backup_name = f"safaripos_before_reset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    backup_dir = os.path.join(os.path.dirname(DB_PATH), '..', 'backups')
    backup_dir = os.path.abspath(backup_dir)
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, backup_name)
    shutil.copy2(DB_PATH, backup_path)
    
    # Delete data (keep admin user and settings)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tables_to_clear = [
        "sale_items",
        "sales",
        "tax_ledger",
        "purchase_orders",
        "products",
        "categories",
        "customers"
    ]
    
    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
        except Exception as e:
            print(f"Warning: {table}: {e}")
    
    # Delete all users except admin
    cursor.execute("DELETE FROM users WHERE role != 'admin'")
    
    conn.commit()
    conn.close()
    
    return {"message": "Demo data reset. Admin and settings preserved."}

import secrets
import hashlib

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


@router.post("/generate-recovery-code")
async def generate_recovery_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin generates a recovery code. Old code is invalidated."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin")
    
    # Generate code: SAFARI-XXXX-XXXX-XXXX
    parts = [secrets.token_hex(2).upper() for _ in range(3)]
    code = "SAFARI-" + "-".join(parts)
    code_hash = _hash_code(code)
    
    set_setting("recovery_code_hash", code_hash)
    set_setting("recovery_code_used", "false")
    
    return {
        "message": "Recovery code generated. WRITE IT DOWN NOW - it won't be shown again!",
        "code": code
    }


@router.post("/verify-recovery-code")
async def verify_recovery_code(data: dict, db: Session = Depends(get_db)):
    """Verify code without using it (for validation)"""
    code = data.get("code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code required")
    
    stored_hash = get_setting("recovery_code_hash")
    if not stored_hash:
        raise HTTPException(status_code=400, detail="No recovery code set")
    
    if _hash_code(code) != stored_hash:
        raise HTTPException(status_code=401, detail="Invalid recovery code")
    
    return {"valid": True}


@router.post("/reset-password-with-code")
async def reset_password_with_code(data: dict, db: Session = Depends(get_db)):
    """Reset admin password using recovery code. Code is one-time use."""
    code = data.get("code", "").strip().upper()
    new_password = data.get("new_password", "")
    target_email = data.get("email", "").strip()
    
    if not code or not new_password or not target_email:
        raise HTTPException(status_code=400, detail="Code, email, and new password required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    stored_hash = get_setting("recovery_code_hash")
    if not stored_hash:
        raise HTTPException(status_code=400, detail="No recovery code set")
    
    if get_setting("recovery_code_used") == "true":
        raise HTTPException(status_code=400, detail="Recovery code already used")
    
    if _hash_code(code) != stored_hash:
        raise HTTPException(status_code=401, detail="Invalid recovery code")
    
    # Find the admin user
    user = db.query(User).filter((User.email == target_email) | (User.phone == target_email), User.role == "admin", User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin account not found")
    
    user.password_hash = hash_password(new_password)
    db.commit()
    
    # Mark code as used
    set_setting("recovery_code_used", "true")
    
    return {"message": "Password reset successful. Login with new password."}
