from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func
from database import get_db
from models import Sale, Product, SaleItem
from auth import get_current_user

router = APIRouter()

@router.get("/daily")
async def daily_report(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    sales = db.query(Sale).filter(Sale.created_at >= today).all()
    total = sum(s.total_amount for s in sales)
    return {
        "total_transactions": len(sales),
        "total_sales": total,
        "average_sale": total / len(sales) if sales else 0
    }

@router.get("/low-stock")
async def low_stock(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(Product).filter(Product.stock <= Product.low_stock_alert, Product.is_active == True).all()
