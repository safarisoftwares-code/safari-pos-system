from fastapi import APIRouter, Depends, HTTPException
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

@router.post("/create")
async def create_backup(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a backup of the database - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create backups")
    
    try:
        # Get database path
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database", "safaripos.db")
        
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="Database not found")
        
        # Create backup filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"safaripos_backup_{timestamp}.db"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)
        
        # Copy database file
        shutil.copy2(db_path, backup_path)
        
        return {
            "message": "Backup created successfully",
            "filename": backup_filename,
            "path": backup_path,
            "size": os.path.getsize(backup_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@router.get("/list")
async def list_backups(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """List all backups - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view backups")
    
    backups = []
    for filename in os.listdir(BACKUP_DIR):
        if filename.endswith(".db"):
            filepath = os.path.join(BACKUP_DIR, filename)
            backups.append({
                "filename": filename,
                "size": os.path.getsize(filepath),
                "created": datetime.fromtimestamp(os.path.getctime(filepath)).strftime("%Y-%m-%d %H:%M:%S")
            })
    
    # Sort by creation time (newest first)
    backups.sort(key=lambda x: x["created"], reverse=True)
    return backups

@router.get("/download/{filename}")
async def download_backup(filename: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Download a backup file - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can download backups")
    
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    return FileResponse(filepath, filename=filename)

@router.delete("/{filename}")
async def delete_backup(filename: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a backup - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete backups")
    
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    os.remove(filepath)
    return {"message": "Backup deleted successfully"}
