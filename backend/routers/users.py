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
    
        # Normalize: empty string becomes None
    email = user_data.email.strip() if user_data.email and user_data.email.strip() else None
    phone = user_data.phone.strip() if user_data.phone and user_data.phone.strip() else None
    
    # Require at least one login method
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Either Email or Phone number is required")
    
    # Auto-generate hidden email for phone-only users (satisfies DB NOT NULL constraint)
    if not email and phone:
        email = f"{phone}@safari-pos.local"
    
    # Check for existing by email
    if email:
        existing = db.query(User).filter(User.email == email).first()
        if existing and existing.is_active:
            raise HTTPException(status_code=400, detail="Email already registered")
        if existing and not existing.is_active:
            existing.name = user_data.name
            existing.password_hash = hash_password(user_data.password)
            existing.phone = phone
            existing.role = user_data.role
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing
    
    # Check for existing by phone
    if phone:
        existing_phone = db.query(User).filter(User.phone == phone).first()
        if existing_phone and existing_phone.is_active:
            raise HTTPException(status_code=400, detail="Phone already registered")
        if existing_phone and not existing_phone.is_active:
            existing_phone.name = user_data.name
            existing_phone.password_hash = hash_password(user_data.password)
            existing_phone.email = email
            existing_phone.role = user_data.role
            existing_phone.is_active = True
            db.commit()
            db.refresh(existing_phone)
            return existing_phone
    
    # Create new user
    user = User(
        name=user_data.name,
        email=email,
        password_hash=hash_password(user_data.password),
        phone=phone,
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
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
    if user.role == "admin" and admin_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only admin account")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}


@router.put('/{user_id}/admin-edit')
async def admin_edit_user(user_id: int, data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Only admin can edit users')
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if 'name' in data and data['name']:
        user.name = data['name']
    if 'email' in data and data['email']:
        existing = db.query(User).filter(User.email == data['email'], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail='Email already in use')
        user.email = data['email']
    if 'phone' in data and data['phone']:
        existing_phone = db.query(User).filter(User.phone == data['phone'], User.id != user_id).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail='Phone already in use')
        user.phone = data['phone']
    if 'password' in data and data['password']:
        user.password_hash = hash_password(data['password'])
    if 'role' in data and data['role']:
        user.role = data['role']
    db.commit()
    db.refresh(user)
    return {'message': 'User updated successfully', 'user_id': user.id}


@router.put('/me')
async def update_my_profile(data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if 'name' in data and data['name']:
        current_user.name = data['name']
    if 'email' in data and data['email']:
        existing = db.query(User).filter(User.email == data['email'], User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail='Email already in use')
        current_user.email = data['email']
    if 'phone' in data and data['phone']:
        existing = db.query(User).filter(User.phone == data['phone'], User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail='Phone already in use')
        current_user.phone = data['phone']
    if 'password' in data and data['password']:
        current_user.password_hash = hash_password(data['password'])
    db.commit()
    db.refresh(current_user)
    return {'message': 'Profile updated'}

