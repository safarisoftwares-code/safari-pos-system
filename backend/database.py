from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'database', 'safaripos.db')
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database and create backup"""
    from models import User
    from auth import hash_password
    import shutil
    from datetime import datetime
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create database backup before any changes
    backup_dir = os.path.join(BASE_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    
    db = SessionLocal()
    
    # Create default admin if not exists
    admin_email = os.getenv("ADMIN_EMAIL", "info@safarisoftwares.co.ke")
    admin = db.query(User).filter(User.email == admin_email).first()
    if not admin:
        admin = User(
            name=os.getenv("ADMIN_NAME", "Admin"),
            email=admin_email,
            password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "info123")),
            role="admin"
        )
        db.add(admin)
        db.commit()
        print("Default admin created")
    
    db.close()
    
    # Create automatic backup
    try:
        if os.path.exists(DB_PATH):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(backup_dir, f"auto_backup_{timestamp}.db")
            shutil.copy2(DB_PATH, backup_path)
            print(f"Automatic backup created: auto_backup_{timestamp}.db")
    except Exception as e:
        print(f"Backup warning: {e}")
