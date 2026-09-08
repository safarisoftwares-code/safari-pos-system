from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import PurchaseOrder, Product
from auth import get_current_user
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class PurchaseOrderCreate(BaseModel):
    supplier: str
    product_id: int
    quantity: int
    unit_cost: float

@router.post("/")
async def create_po(po_data: PurchaseOrderCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get product by ID - no spelling issues!
    product = db.query(Product).filter(Product.id == po_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    total = po_data.quantity * po_data.unit_cost
    po = PurchaseOrder(
        supplier=po_data.supplier,
        product_name=product.name,
        unit=product.unit,
        quantity=po_data.quantity,
        unit_cost=po_data.unit_cost,
        total_cost=total,
        created_by=current_user.id
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po

@router.get("/")
async def get_pos(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()

@router.put("/{po_id}/status")
async def update_po_status(po_id: int, status: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    old_status = po.status
    po.status = status
    
    if status == "received" and old_status != "received":
        # Match by name AND unit from the PO (which came from product)
        product = db.query(Product).filter(
            Product.name == po.product_name,
            Product.unit == po.unit
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=400,
                detail=f"Product '{po.product_name}' ({po.unit}) not found."
            )
        
        old_stock = product.stock
        old_cost = product.cost or 0
        new_qty = po.quantity
        new_cost = po.unit_cost
        
        total_old_value = old_stock * old_cost
        total_new_value = new_qty * new_cost
        total_units = old_stock + new_qty
        
        if total_units > 0:
            average_cost = (total_old_value + total_new_value) / total_units
            product.cost = round(average_cost, 2)
        
        product.stock = total_units
    
    db.commit()
    return {
        "message": f"PO marked as {status}",
        "product": po.product_name,
        "unit": po.unit,
        "new_stock": product.stock if status == "received" else None
    }
