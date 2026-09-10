from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import Base, engine, SessionLocal
from models import User
from auth import hash_password
from routers import auth, products, sales, customers, reports, users, backup, settings, purchase_orders, analytics, mpesa, tax
import os
import sys
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Safari POS System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(sales.router, prefix="/api/v1/sales", tags=["sales"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["customers"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(backup.router, prefix="/api/v1/backup", tags=["backup"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(mpesa.router, prefix="/api/v1/mpesa", tags=["mpesa"])
app.include_router(tax.router, prefix="/api/v1/tax", tags=["tax"])
app.include_router(purchase_orders.router, prefix="/api/v1/purchase-orders", tags=["purchase-orders"])

# PyInstaller EXE support
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app.mount("/static/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/static/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/login")
async def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    admin_email = os.getenv("ADMIN_EMAIL", "info@safarisoftwares.co.ke")
    admin_password = os.getenv("ADMIN_PASSWORD", "info123")
    admin_name = os.getenv("ADMIN_NAME", "Admin")
    
    admin = db.query(User).filter(User.email == admin_email).first()
    if not admin:
        admin = User(
            name=admin_name,
            email=admin_email,
            password_hash=hash_password(admin_password),
            role="admin"
        )
        db.add(admin)
        db.commit()
        print("")
        print("========================================")
        print("  Safari POS System Started!")
        print(f"  Admin: {admin_email}")
        print("  Access: http://localhost:8000")
        print("========================================")
        print("")
    db.close()
