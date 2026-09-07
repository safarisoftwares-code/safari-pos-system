from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Customer
from schemas import CustomerCreate
from auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_customers(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Customer).all()

@router.post("/")
async def create_customer(customer_data: CustomerCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    customer = Customer(**customer_data.dict())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer
