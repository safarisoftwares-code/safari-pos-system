from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, Token
from auth import hash_password, verify_password, create_access_token

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Accept login with email OR phone
    identifier = user_data.email.strip()
    
    # Try email first
    user = db.query(User).filter(User.email == identifier).first()
    
    # If not found, try phone (normalize first)
    if not user and identifier:
        # Normalize phone: remove non-digits, handle 0 prefix
        cleaned = ''.join(c for c in identifier if c.isdigit())
        if cleaned.startswith('0'):
            cleaned_alt = cleaned[1:]  # Without 0
        else:
            cleaned_alt = '0' + cleaned  # With 0
        
        # Try all possible formats
        user = db.query(User).filter(
            (User.phone == cleaned) | 
            (User.phone == cleaned_alt) |
            (User.phone == '254' + cleaned_alt)
        ).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token, user=user)

@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
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
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token, user=user)
