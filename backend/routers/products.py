from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Product, Category
from schemas import ProductCreate, ProductResponse, CategoryCreate, CategoryResponse
from auth import get_current_user

router = APIRouter()

# Categories - NO trailing slashes
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("/categories", response_model=CategoryResponse)
async def create_category(category_data: CategoryCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == category_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    category = Category(name=category_data.name, description=category_data.description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

# Products
@router.get("", response_model=List[ProductResponse])
async def get_products(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.is_active == True).all()

@router.post("", response_model=ProductResponse)
async def create_product(product_data: ProductCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    product = Product(**product_data.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}")
async def delete_product(product_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"message": "Product deleted"}


@router.put("/{product_id}/stock")
async def adjust_stock(product_id: int, adjustment: int, reason: str = "manual", current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Adjust stock manually (positive = add, negative = remove)"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_stock = product.stock + adjustment
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    product.stock = new_stock
    db.commit()
    db.refresh(product)
    
    return {
        "message": f"Stock adjusted",
        "product": product.name,
        "old_stock": product.stock - adjustment,
        "adjustment": adjustment,
        "new_stock": product.stock,
        "reason": reason
    }
