import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.all_models import User

# Import routers
from app.api.auth import router as auth_router
from app.api.employees import router as employees_router
from app.api.disciplinary import router as disciplinary_router
from app.api.shifts import router as shifts_router
from app.api.reports import router as reports_router
from app.api.dashboard import router as dashboard_router
from app.api.audit import router as audit_router
from app.api.financial import router as financial_router
from app.api.backup import router as backup_router


# Create Database tables on startup
Base.metadata.create_all(bind=engine)

def auto_migrate():
    db = SessionLocal()
    try:
        columns_to_add = {
            "ctps": "VARCHAR(30)",
            "pis": "VARCHAR(30)",
            "reservista": "VARCHAR(30)"
        }
        for col_name, col_type in columns_to_add.items():
            try:
                # Use text() to avoid warnings, or simple raw SQL execute
                from sqlalchemy import text
                db.execute(text(f"SELECT {col_name} FROM employees LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col_name} to employees table...")
                db.execute(text(f"ALTER TABLE employees ADD COLUMN {col_name} {col_type}"))
                db.commit()
    except Exception as e:
        print(f"Auto-migration error: {e}")
    finally:
        db.close()

auto_migrate()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API - MeuRestô",
    version="1.0.0"
)

# Setup CORS
origins = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:5173", # Default Vite development port
    "http://127.0.0.1:5173",
    "*" # Permissive CORS for development/testing ease
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed default administrator user if database is empty
def seed_admin_user():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            hashed_pwd = get_password_hash("admin")
            default_admin = User(
                username="admin",
                email="admin@meuresto.com.br",
                password_hash=hashed_pwd,
                role="admin",
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            print("Seeded default administrator user (admin / admin)")
    except Exception as e:
        print(f"Error seeding default admin user: {e}")
    finally:
        db.close()

seed_admin_user()

# Mount upload directory to serve static images/documents
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register Routers
app.include_router(auth_router, prefix="/api")
app.include_router(employees_router, prefix="/api")
app.include_router(disciplinary_router, prefix="/api")
app.include_router(shifts_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(financial_router, prefix="/api")
app.include_router(backup_router, prefix="/api")


@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }
