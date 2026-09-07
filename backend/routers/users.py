from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User
from schemas import UserCreate, UserResponse
from auth import hash_password, get_current_user

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
async def get_users(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view users")
    return db.query(User).filter(User.is_active == True).all()

@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create users")
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        phone=user_data.phone,
        role=user_data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
async def delete_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete users")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}
