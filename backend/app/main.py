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
from app.api.groups import router as groups_router
from app.api.suppliers import router as suppliers_router
from app.api.sectors import router as sectors_router
from app.api.job_positions import router as job_positions_router
from app.api.work_scales import router as work_scales_router
from app.api.inventory import router as inventory_router


# Create Database tables on startup
Base.metadata.create_all(bind=engine)

def auto_migrate():
    db = SessionLocal()
    try:
        from sqlalchemy import text
        # 1. Create groups table if not exists
        try:
            db.execute(text("SELECT id FROM groups LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Creating groups table...")
            db.execute(text("""
                CREATE TABLE groups (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    is_active BOOLEAN DEFAULT true NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            db.commit()

        # 1b. Create suppliers table if not exists
        try:
            db.execute(text("SELECT id FROM suppliers LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Creating suppliers table...")
            db.execute(text("""
                CREATE TABLE suppliers (
                    id VARCHAR(36) PRIMARY KEY,
                    group_id VARCHAR(36),
                    corporate_name VARCHAR(255) NOT NULL,
                    trade_name VARCHAR(255) NOT NULL,
                    cnpj VARCHAR(20) NOT NULL,
                    state_inscription VARCHAR(30),
                    contact_person VARCHAR(100),
                    phone VARCHAR(20),
                    whatsapp VARCHAR(20),
                    email VARCHAR(100),
                    address VARCHAR(255),
                    category VARCHAR(50) NOT NULL,
                    preferred_payment_method VARCHAR(50),
                    bank VARCHAR(50),
                    agency VARCHAR(20),
                    account VARCHAR(30),
                    pix_key VARCHAR(100),
                    payment_terms VARCHAR(100),
                    delivery_days VARCHAR(100),
                    notes TEXT,
                    is_active BOOLEAN DEFAULT true NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(50),
                    updated_by VARCHAR(50)
                )
            """))
            db.commit()

        # 2. Add ctps, pis, reservista, user_id, password_reset_requested, has_financial_access (old migrations)
        columns_to_add = {
            "ctps": ("employees", "VARCHAR(30)"),
            "pis": ("employees", "VARCHAR(30)"),
            "reservista": ("employees", "VARCHAR(30)"),
            "user_id": ("employees", "VARCHAR(36)"),
        }
        for col_name, (table_name, col_type) in columns_to_add.items():
            try:
                db.execute(text(f"SELECT {col_name} FROM {table_name} LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col_name} to {table_name} table...")
                db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                db.commit()

        # Add user_id to financial_revenues
        try:
            db.execute(text("SELECT user_id FROM financial_revenues LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Adding column user_id to financial_revenues table...")
            db.execute(text("ALTER TABLE financial_revenues ADD COLUMN user_id VARCHAR(36)"))
            db.commit()

        # Add user_id to financial_expenses
        try:
            db.execute(text("SELECT user_id FROM financial_expenses LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Adding column user_id to financial_expenses table...")
            db.execute(text("ALTER TABLE financial_expenses ADD COLUMN user_id VARCHAR(36)"))
            db.commit()

        # Add password_reset_requested to users
        try:
            db.execute(text("SELECT password_reset_requested FROM users LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Adding column password_reset_requested to users table...")
            db.execute(text("ALTER TABLE users ADD COLUMN password_reset_requested BOOLEAN DEFAULT false"))
            db.commit()

        # Add has_financial_access to users
        try:
            db.execute(text("SELECT has_financial_access FROM users LIMIT 1"))
        except Exception:
            db.rollback()
            print("Auto-migration: Adding column has_financial_access to users table...")
            db.execute(text("ALTER TABLE users ADD COLUMN has_financial_access BOOLEAN DEFAULT false"))
            db.commit()

        # 3. Add group_id to users, employees, financial_revenues, financial_expenses, audit_logs
        group_columns = [
            ("users", "group_id"),
            ("employees", "group_id"),
            ("financial_revenues", "group_id"),
            ("financial_expenses", "group_id"),
            ("audit_logs", "group_id")
        ]
        for table, col in group_columns:
            try:
                db.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col} to {table} table...")
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} VARCHAR(36)"))
                db.commit()

        # 3b. Add new evolved financial columns
        financial_new_cols = [
            # Revenues
            ("financial_revenues", "expected_date", "DATE"),
            ("financial_revenues", "received_date", "DATE"),
            ("financial_revenues", "payment_method", "VARCHAR(50)"),
            ("financial_revenues", "status", "VARCHAR(20)"),
            ("financial_revenues", "client", "VARCHAR(255)"),
            ("financial_revenues", "observations", "TEXT"),
            ("financial_revenues", "created_at", "TIMESTAMP"),
            ("financial_revenues", "updated_at", "TIMESTAMP"),
            ("financial_revenues", "updated_by", "VARCHAR(50)"),
            ("financial_revenues", "change_history", "TEXT"),
            # Expenses
            ("financial_expenses", "supplier_id", "VARCHAR(36)"),
            ("financial_expenses", "due_date", "DATE"),
            ("financial_expenses", "payment_date", "DATE"),
            ("financial_expenses", "payment_method", "VARCHAR(50)"),
            ("financial_expenses", "status", "VARCHAR(20)"),
            ("financial_expenses", "observations", "TEXT"),
            ("financial_expenses", "is_recurring", "BOOLEAN"),
            ("financial_expenses", "recurrence_period", "VARCHAR(20)"),
            ("financial_expenses", "created_at", "TIMESTAMP"),
            ("financial_expenses", "updated_at", "TIMESTAMP"),
            ("financial_expenses", "updated_by", "VARCHAR(50)"),
            ("financial_expenses", "change_history", "TEXT"),
        ]
        for table, col, col_type in financial_new_cols:
            try:
                db.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col} to {table} table...")
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                db.commit()

        # 3c. Add new evolved HR columns
        hr_new_cols = [
            # Employees
            ("employees", "sex", "VARCHAR(20)"),
            ("employees", "bank_name", "VARCHAR(100)"),
            ("employees", "bank_agency", "VARCHAR(20)"),
            ("employees", "bank_account", "VARCHAR(30)"),
            ("employees", "pix_key", "VARCHAR(100)"),
            ("employees", "notes", "TEXT"),
            # Contracts
            ("contracts", "job_position_id", "VARCHAR(36)"),
            ("contracts", "sector_id", "VARCHAR(36)"),
            ("contracts", "work_scale_id", "VARCHAR(36)"),
            ("contracts", "contract_type", "VARCHAR(50) DEFAULT 'CLT'"),
            ("contracts", "status", "VARCHAR(20) DEFAULT 'Experiência'"),
        ]
        for table, col, col_type in hr_new_cols:
            try:
                db.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col} to {table} table...")
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                db.commit()

        # Add new user permission columns
        user_perm_cols = [
            ("users", "has_suppliers_access", "BOOLEAN DEFAULT false"),
            ("users", "has_reports_access", "BOOLEAN DEFAULT false"),
            ("users", "has_hr_access", "BOOLEAN DEFAULT false"),
            ("users", "financial_access", "VARCHAR(20) DEFAULT 'none'"),
            ("users", "suppliers_access", "VARCHAR(20) DEFAULT 'none'"),
            ("users", "hr_access", "VARCHAR(20) DEFAULT 'none'"),
            ("users", "reports_access", "VARCHAR(20) DEFAULT 'none'"),
        ]
        for table, col, col_type in user_perm_cols:
            try:
                db.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"Auto-migration: Adding column {col} to {table} table...")
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                db.commit()

        # Migrate/set default permissions for roles
        try:
            db.execute(text("UPDATE users SET has_suppliers_access = 1, has_reports_access = 1, has_hr_access = 1 WHERE role IN ('admin', 'admin_delegado')"))
            db.execute(text("UPDATE users SET has_hr_access = 1, has_reports_access = 1 WHERE role = 'rh'"))
            db.execute(text("UPDATE users SET has_suppliers_access = 1 WHERE role = 'financeiro'"))
            
            # Grant full write access to admins, managers, and partners
            db.execute(text("UPDATE users SET financial_access = 'write', suppliers_access = 'write', hr_access = 'write', reports_access = 'write' WHERE role IN ('admin', 'admin_delegado')"))
            db.execute(text("UPDATE users SET hr_access = 'write', reports_access = 'write' WHERE role = 'rh'"))
            db.execute(text("UPDATE users SET financial_access = 'write', suppliers_access = 'write' WHERE role = 'financeiro'"))
            db.execute(text("UPDATE users SET financial_access = 'write', suppliers_access = 'write', hr_access = 'write', reports_access = 'write' WHERE role IN ('gestor', 'socio')"))
            
            # Map legacy boolean column values to new string column values if not set yet
            db.execute(text("UPDATE users SET financial_access = 'write' WHERE has_financial_access = 1 AND financial_access = 'none'"))
            db.execute(text("UPDATE users SET suppliers_access = 'write' WHERE has_suppliers_access = 1 AND suppliers_access = 'none'"))
            db.execute(text("UPDATE users SET hr_access = 'write' WHERE has_hr_access = 1 AND hr_access = 'none'"))
            db.execute(text("UPDATE users SET reports_access = 'write' WHERE has_reports_access = 1 AND reports_access = 'none'"))
            
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Auto-migration: Setting user permissions defaults failed: {e}")

        # 4. Check if at least one group exists. If not, create a default group.
        default_group = db.execute(text("SELECT id FROM groups LIMIT 1")).fetchone()
        if not default_group:
            import uuid
            from datetime import datetime
            default_group_id = str(uuid.uuid4())
            db.execute(text(f"INSERT INTO groups (id, name, is_active, created_at) VALUES ('{default_group_id}', 'Grupo Padrão', 1, '{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}')"))
            db.commit()
            print(f"Auto-migration: Created default group with ID {default_group_id}")
        else:
            default_group_id = default_group[0]

        # 5. Populate group_id for existing records
        # Update users, employees, financial data, and audit logs to the default group if null (admin master remains null)
        db.execute(text(f"UPDATE users SET group_id = '{default_group_id}' WHERE group_id IS NULL AND username != 'admin'"))
        db.execute(text(f"UPDATE employees SET group_id = '{default_group_id}' WHERE group_id IS NULL"))
        db.execute(text(f"UPDATE financial_revenues SET group_id = '{default_group_id}' WHERE group_id IS NULL"))
        db.execute(text(f"UPDATE financial_expenses SET group_id = '{default_group_id}' WHERE group_id IS NULL"))
        db.execute(text(f"UPDATE audit_logs SET group_id = '{default_group_id}' WHERE group_id IS NULL"))
        db.commit()

        # 5b. Migrate legacy financial columns data
        try:
            db.execute(text("UPDATE financial_revenues SET expected_date = date WHERE expected_date IS NULL"))
            db.execute(text("UPDATE financial_revenues SET status = 'Recebido' WHERE status IS NULL OR status = ''"))
            db.execute(text("UPDATE financial_revenues SET received_date = date WHERE received_date IS NULL AND status = 'Recebido'"))
            db.execute(text("UPDATE financial_revenues SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            db.execute(text("UPDATE financial_revenues SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))

            db.execute(text("UPDATE financial_expenses SET due_date = date WHERE due_date IS NULL"))
            db.execute(text("UPDATE financial_expenses SET status = 'Pago' WHERE status IS NULL OR status = ''"))
            db.execute(text("UPDATE financial_expenses SET payment_date = date WHERE payment_date IS NULL AND status = 'Pago'"))
            db.execute(text("UPDATE financial_expenses SET is_recurring = 0 WHERE is_recurring IS NULL"))
            db.execute(text("UPDATE financial_expenses SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            db.execute(text("UPDATE financial_expenses SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Auto-migration: Legacy financial update failed: {e}")

        # Update existing records to default admin's user_id if null (old migration)
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            db.execute(text(f"UPDATE employees SET user_id = '{admin_user.id}' WHERE user_id IS NULL"))
            db.execute(text(f"UPDATE financial_revenues SET user_id = '{admin_user.id}' WHERE user_id IS NULL"))
            db.execute(text(f"UPDATE financial_expenses SET user_id = '{admin_user.id}' WHERE user_id IS NULL"))
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
app.include_router(groups_router, prefix="/api")
app.include_router(suppliers_router, prefix="/api")
app.include_router(sectors_router, prefix="/api")
app.include_router(job_positions_router, prefix="/api")
app.include_router(work_scales_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")


@app.on_event("startup")
def startup_event():
    from app.services.backup_service import start_backup_scheduler
    start_backup_scheduler()


@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }
