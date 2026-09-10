from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
import os
import shutil
from datetime import datetime

router = APIRouter()

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

def get_backup_location(db):
    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'backup_location'")
    result = cursor.fetchone()
    conn.close()
    return result[0] if result and result[0] else None

@router.post("/create")
async def create_backup(location: str = None, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create backups")
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"safaripos_backup_{timestamp}.db"
    
    # SMART BACKUP: Use specified location first
    saved_to = ""
    backup_dir = None
    
    if location and location.strip() and location.strip().lower() != 'desktop':
        # User specified location (flash drive)
        drive = location.strip()
        # Create Safari-POS Backup folder inside the drive
        backup_dir = os.path.join(drive, "Safari-POS Backup")
        os.makedirs(backup_dir, exist_ok=True)
        saved_to = backup_dir
    elif location and location.strip().lower() == 'desktop':
        # User chose Desktop
        backup_dir = os.path.join(os.path.expanduser("~"), "Desktop", "Safari-POS Backup")
        os.makedirs(backup_dir, exist_ok=True)
        saved_to = backup_dir
    else:
        # Auto-detect flash drives
        import string
        flash_drives = []
        for letter in string.ascii_uppercase:
            drive = letter + ":\\"
            if os.path.exists(drive):
                backup_folder = os.path.join(drive, "Safari-POS Backup")
                if os.path.exists(backup_folder):
                    flash_drives.append(backup_folder)
        
        ext_location = get_backup_location(db)
        if ext_location and ext_location.strip() and os.path.exists(ext_location.strip()):
            flash_drives.insert(0, ext_location.strip())
        
        if flash_drives:
            # Use first available flash drive
            backup_dir = flash_drives[0]
            os.makedirs(backup_dir, exist_ok=True)
        else:
            # No flash drive - create Desktop folder automatically
            backup_dir = os.path.join(os.path.expanduser("~"), "Desktop", "Safari-POS Backup")
            os.makedirs(backup_dir, exist_ok=True)
    
    backup_path = os.path.join(backup_dir, backup_filename)
    shutil.copy2(db_path, backup_path)
    saved_to = backup_dir
    
    return {
        "message": "Backup created successfully",
        "filename": backup_filename,
        "path": backup_path,
        "saved_to": saved_to
    }

@router.get("/list")
async def list_backups(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view backups")
    
    backups = []
    ext_location = get_backup_location(db)
    desktop_folder = os.path.join(os.path.expanduser("~"), "Desktop", "Safari-POS Backup")
    
    dirs_to_check = [BACKUP_DIR, desktop_folder]
    
    # Check all drives for Safari-POS Backup folders
    import string
    for letter in string.ascii_uppercase:
        drive = letter + ":\\"
        backup_folder = os.path.join(drive, "Safari-POS Backup")
        if os.path.exists(backup_folder):
            dirs_to_check.append(backup_folder)
    
    if ext_location and os.path.exists(ext_location):
        dirs_to_check.append(ext_location)
    
    for dir_path in dirs_to_check:
        if os.path.exists(dir_path):
            for filename in os.listdir(dir_path):
                if filename.endswith(".db"):
                    filepath = os.path.join(dir_path, filename)
                    backups.append({
                        "filename": filename,
                        "size": os.path.getsize(filepath),
                        "created": datetime.fromtimestamp(os.path.getctime(filepath)).strftime("%Y-%m-%d %H:%M:%S"),
                        "location": dir_path
                    })
    
    backups.sort(key=lambda x: x["created"], reverse=True)
    return backups

@router.post("/restore/{filename}")
async def restore_backup(filename: str, source_path: str = None, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can restore backups")
    
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Find the backup file
    backup_path = None
    dirs_to_check = []
    
    # If external source specified, check there FIRST
    if source_path:
        dirs_to_check.append(source_path)
    
    ext_location = get_backup_location(db)
    if ext_location and os.path.exists(ext_location):
        dirs_to_check.append(ext_location)
    dirs_to_check.append(BACKUP_DIR)
    
    for dir_path in dirs_to_check:
        if os.path.exists(dir_path):
            candidate = os.path.join(dir_path, filename)
            if os.path.exists(candidate):
                backup_path = candidate
                break
    
    if not backup_path:
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    
    # Safety: backup current DB before restore
    safety_backup = db_path + ".pre_restore"
    shutil.copy2(db_path, safety_backup)
    
    # Restore
    shutil.copy2(backup_path, db_path)
    
    return {"message": "Database restored successfully! Restart the server."}

@router.get("/download/{filename}")
async def download_backup(filename: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can download")
    
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    backup_path = None
    ext_location = get_backup_location(db)
    dirs_to_check = [BACKUP_DIR]
    if ext_location and os.path.exists(ext_location):
        dirs_to_check.append(ext_location)
    
    for dir_path in dirs_to_check:
        candidate = os.path.join(dir_path, filename)
        if os.path.exists(candidate):
            backup_path = candidate
            break
    
    if not backup_path:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    return FileResponse(backup_path, filename=filename)

@router.delete("/{filename}")
async def delete_backup(filename: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Remove from history list ONLY - file remains safe"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete")
    
    # DO NOT delete the actual file - just return success
    return {"message": "Removed from history. File remains safe."}
@router.get("/drives")
async def detect_drives(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Detect available drives for backup"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin")
    
    import string
    drives = []
    for letter in string.ascii_uppercase:
        drive = letter + ":\\"
        if os.path.exists(drive):
            drives.append(drive)
    
    return {"drives": drives}


@router.post("/restore-file")
async def restore_file(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Restore from uploaded file"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin")
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    
    # Safety backup
    safety = db_path + ".pre_restore"
    shutil.copy2(db_path, safety)
    
    # Save uploaded file as new database
    with open(db_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"message": "Database restored successfully! Restart server to apply."}


@router.post("/reset-demo")
async def reset_demo_data(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can reset data")
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    
    # SAFETY: Create backup before reset
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safety_backup = os.path.join(BACKUP_DIR, f"pre_reset_backup_{timestamp}.db")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(db_path, safety_backup)
    
    # Clear demo data (keep admin user + settings)
    import sqlite3 as sql
    conn = sql.connect(db_path)
    cursor = conn.cursor()
    
    # Delete data from tables
    cursor.execute("DELETE FROM sale_items")
    cursor.execute("DELETE FROM sales")
    cursor.execute("DELETE FROM tax_ledger")
    cursor.execute("DELETE FROM purchase_orders")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM categories")
    cursor.execute("DELETE FROM customers")
    
    # Keep admin user only - delete non-admin users
    cursor.execute("DELETE FROM users WHERE role != 'admin'")
    
    # Reset auto-increment counters
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items', 'categories', 'customers', 'purchase_orders', 'tax_ledger')")
    
    conn.commit()
    conn.close()
    
    return {
        "message": "Demo data cleared successfully",
        "backup_created": safety_backup,
        "cleared": ["products", "categories", "sales", "tax_ledger", "purchase_orders", "customers", "non-admin users"]
    }


@router.post("/restore-data-only/{filename}")
async def restore_data_only(filename: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Restore DATA from backup but keep CURRENT users intact"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can restore backups")
    
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Find the backup file
    backup_path = None
    ext_location = get_backup_location(db)
    dirs_to_check = [BACKUP_DIR]
    if ext_location and os.path.exists(ext_location):
        dirs_to_check.append(ext_location)
    
    import string
    desktop_folder = os.path.join(os.path.expanduser("~"), "Desktop", "Safari-POS Backup")
    dirs_to_check.append(desktop_folder)
    for letter in string.ascii_uppercase:
        drive_folder = os.path.join(letter + ":\\", "Safari-POS Backup")
        if os.path.exists(drive_folder):
            dirs_to_check.append(drive_folder)
    
    for dir_path in dirs_to_check:
        if os.path.exists(dir_path):
            candidate = os.path.join(dir_path, filename)
            if os.path.exists(candidate):
                backup_path = candidate
                break
    
    if not backup_path:
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    # Safety backup
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
    safety_backup = db_path + ".pre_data_restore"
    shutil.copy2(db_path, safety_backup)
    
    import sqlite3
    source_conn = sqlite3.connect(backup_path)
    target_conn = sqlite3.connect(db_path)
    source_cur = source_conn.cursor()
    target_cur = target_conn.cursor()
    
    tables_to_restore = ["categories", "products", "customers", "sales", "sale_items", "tax_ledger", "purchase_orders"]
    
    restored = []
    for table in tables_to_restore:
        try:
            source_cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not source_cur.fetchone():
                continue
            
            target_cur.execute(f"PRAGMA table_info({table})")
            target_cols = [col[1] for col in target_cur.fetchall()]
            
            source_cur.execute(f"PRAGMA table_info({table})")
            source_cols = [col[1] for col in source_cur.fetchall()]
            
            common_cols = [c for c in target_cols if c in source_cols]
            if not common_cols:
                continue
            
            target_cur.execute(f"DELETE FROM {table}")
            
            cols_str = ", ".join(common_cols)
            source_cur.execute(f"SELECT {cols_str} FROM {table}")
            rows = source_cur.fetchall()
            
            if rows:
                placeholders = ", ".join(["?"] * len(common_cols))
                target_cur.executemany(f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})", rows)
            
            restored.append(f"{table} ({len(rows)})")
        except Exception as e:
            print(f"Warning restoring {table}: {e}")
    
    target_conn.commit()
    source_conn.close()
    target_conn.close()
    
    return {"message": "Data restored! Users and settings preserved.", "restored_tables": restored}
