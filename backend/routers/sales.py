from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import Sale, SaleItem, Product, User
from schemas import SaleCreate
from auth import get_current_user

router = APIRouter()

def generate_receipt_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    count = db.query(Sale).filter(Sale.receipt_no.like(f"INV-{today}-%")).count()
    return f"INV-{today}-{count + 1:04d}"

@router.post("/")
async def create_sale(sale_data: SaleCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    subtotal = 0
    total_tax = 0
    sale_items_data = []
    
    for item in sale_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
        
        line_total = item.quantity * item.unit_price
        # INCLUSIVE TAX: Tax is embedded in the price
        # Tax = Price - (Price / (1 + rate))
        if product.tax_rate and product.tax_rate > 0:
            rate = product.tax_rate / 100
            line_tax = line_total - (line_total / (1 + rate))
        else:
            line_tax = 0
        
        subtotal += line_total
        total_tax += line_tax
        
        sale_items_data.append({
            "product": product,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "tax_rate": product.tax_rate or 0,
            "tax_amount": line_tax,
            "total_price": line_total
        })
    
    discount = sale_data.discount
    # Tax is INCLUSIVE - total = subtotal - discount (tax already in subtotal)
    total = subtotal - discount
    
    sale = Sale(
        receipt_no=generate_receipt_no(db),
        customer_id=sale_data.customer_id,
        cashier_id=current_user.id,
        subtotal=subtotal,
        tax_amount=total_tax,
        discount=discount,
        total_amount=total,
        payment_method=sale_data.payment_method
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    
    for item in sale_items_data:
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item["product"].id,
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            tax_rate=item["tax_rate"],
            tax_amount=item["tax_amount"],
            total_price=item["total_price"]
        )
        db.add(sale_item)
        item["product"].stock -= item["quantity"]
    
    db.commit()
    
    return {
        "id": sale.id,
        "receipt_no": sale.receipt_no,
        "subtotal": subtotal,
        "tax_amount": total_tax,
        "discount": discount,
        "total_amount": total,
        "payment_method": sale.payment_method,
        "created_at": sale.created_at.isoformat(),
        "items": [
            {
                "name": item["product"].name,
                "unit": item["product"].unit,
                "quantity": item["quantity"],
                "unit_price": item["unit_price"],
                "tax_rate": item["tax_rate"],
                "tax_amount": item["tax_amount"],
                "total_price": item["total_price"]
            }
            for item in sale_items_data
        ]
    }

@router.get("/today")
async def get_today_sales(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if current_user.role in ["admin", "manager"]:
        sales = db.query(Sale).filter(Sale.created_at >= today).all()
    else:
        sales = db.query(Sale).filter(Sale.created_at >= today, Sale.cashier_id == current_user.id).all()
    
    return {
        "count": len(sales),
        "total_amount": sum(s.total_amount for s in sales),
        "sales": [
            {
                "receipt_no": s.receipt_no,
                "subtotal": s.subtotal,
                "tax_amount": s.tax_amount,
                "total_amount": s.total_amount,
                "payment_method": s.payment_method,
                "created_at": s.created_at.strftime("%H:%M:%S"),
                "cashier": db.query(User).filter(User.id == s.cashier_id).first().name
            }
            for s in sales
        ]
    }

@router.get("/all")
async def get_all_sales(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(100).all()
    
    return [
        {
            "receipt_no": s.receipt_no,
            "subtotal": s.subtotal,
            "tax_amount": s.tax_amount,
            "total_amount": s.total_amount,
            "payment_method": s.payment_method,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "cashier": db.query(User).filter(User.id == s.cashier_id).first().name
        }
        for s in sales
    ]


@router.get("/daily-close")
async def daily_close(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """End of day summary by payment method"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if current_user.role in ["admin", "manager"]:
        sales = db.query(Sale).filter(Sale.created_at >= today).all()
    else:
        sales = db.query(Sale).filter(Sale.created_at >= today, Sale.cashier_id == current_user.id).all()
    
    cash_total = sum(s.total_amount for s in sales if s.payment_method == 'cash')
    mpesa_total = sum(s.total_amount for s in sales if s.payment_method == 'mpesa')
    card_total = sum(s.total_amount for s in sales if s.payment_method == 'card')
    credit_total = sum(s.total_amount for s in sales if s.payment_method == 'credit')
    total = sum(s.total_amount for s in sales)
    
    return {
        "date": today.strftime("%Y-%m-%d"),
        "total_transactions": len(sales),
        "cash_total": cash_total,
        "mpesa_total": mpesa_total,
        "card_total": card_total,
        "credit_total": credit_total,
        "grand_total": total
    }


@router.get("/history")
async def receipt_history(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all receipts with items for reprinting"""
    if current_user.role in ["admin", "manager"]:
        sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(50).all()
    else:
        sales = db.query(Sale).filter(Sale.cashier_id == current_user.id).order_by(Sale.created_at.desc()).limit(50).all()
    
    result = []
    for sale in sales:
        items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        result.append({
            "receipt_no": sale.receipt_no,
            "total_amount": sale.total_amount,
            "subtotal": sale.subtotal,
            "tax_amount": sale.tax_amount,
            "discount": sale.discount,
            "payment_method": sale.payment_method,
            "created_at": sale.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "cashier": db.query(User).filter(User.id == sale.cashier_id).first().name,
            "items": [
                {
                    "name": db.query(Product).filter(Product.id == item.product_id).first().name if db.query(Product).filter(Product.id == item.product_id).first() else "Unknown",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price
                }
                for item in items
            ]
        })
    
    return result


@router.get("/last-receipt")
async def get_last_receipt(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get only the LAST receipt - for reprint after printer failure"""
    
    if current_user.role in ["admin", "manager"]:
        sale = db.query(Sale).order_by(Sale.created_at.desc()).first()
    else:
        # Cashier: only THEIR last receipt from today
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        sale = db.query(Sale).filter(
            Sale.cashier_id == current_user.id,
            Sale.created_at >= today
        ).order_by(Sale.created_at.desc()).first()
    
    if not sale:
        return {"message": "No receipt found"}
    
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
    
    return {
        "receipt_no": sale.receipt_no,
        "total_amount": sale.total_amount,
        "subtotal": sale.subtotal,
        "tax_amount": sale.tax_amount,
        "discount": sale.discount,
        "payment_method": sale.payment_method,
        "created_at": sale.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "cashier": db.query(User).filter(User.id == sale.cashier_id).first().name,
        "items": [
            {
                "name": db.query(Product).filter(Product.id == item.product_id).first().name if db.query(Product).filter(Product.id == item.product_id).first() else "Unknown",
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price
            }
            for item in items
        ]
    }
