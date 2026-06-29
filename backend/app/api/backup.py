import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db, engine
from app.core.config import settings
from app.api.auth import get_current_user, RoleChecker
from app.models.all_models import User
from app.services.audit_service import log_action

router = APIRouter(prefix="/backup", tags=["backup"])

@router.get("/download")
def download_backup(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(RoleChecker(["admin", "admin_delegado"]))
):
    """
    Export database: returns the active SQLite file as a attachment download.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(
            status_code=400, 
            detail="Backup de arquivo só é suportado para bancos de dados locais SQLite."
        )
    
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Arquivo de banco de dados não encontrado.")
    
    import sqlite3
    import uuid
    
    temp_backup_path = f"{db_path}.download.{uuid.uuid4().hex}"
    try:
        src_conn = sqlite3.connect(db_path)
        dest_conn = sqlite3.connect(temp_backup_path)
        with dest_conn:
            src_conn.backup(dest_conn)
        src_conn.close()
        dest_conn.close()
        
        background_tasks.add_task(os.remove, temp_backup_path)
        return FileResponse(
            path=temp_backup_path,
            filename="meuresto_backup.db",
            media_type="application/x-sqlite3"
        )
    except Exception as e:
        if os.path.exists(temp_backup_path):
            os.remove(temp_backup_path)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar backup: {str(e)}")

@router.post("/restore")
def restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "admin_delegado"]))
):
    """
    Restore database: accepts an uploaded SQLite file and replaces the active lira_rh.db file.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(
            status_code=400, 
            detail="Restauração de arquivo só é suportada para bancos de dados locais SQLite."
        )
    
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    
    # Read first 16 bytes to verify SQLite header
    try:
        header = file.file.read(16)
        file.file.seek(0)
        if not header.startswith(b"SQLite format 3\x00"):
            raise HTTPException(
                status_code=400, 
                detail="Arquivo inválido. O arquivo enviado não é um banco de dados SQLite válido."
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Erro ao ler o arquivo enviado.")

    # Close the current session connection to release locks
    db.close()
    
    # Dispose SQLAlchemy engine to close all connection pool connections
    engine.dispose()
    
    try:
        temp_path = db_path + ".tmp"
        # Write uploaded content to temp file
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Replace the database file safely
        if os.path.exists(db_path):
            old_backup = db_path + ".old"
            if os.path.exists(old_backup):
                os.remove(old_backup)
            os.rename(db_path, old_backup)
            try:
                os.rename(temp_path, db_path)
                os.remove(old_backup)
            except Exception as e:
                # Rollback to old file if renaming fails
                if os.path.exists(old_backup):
                    os.rename(old_backup, db_path)
                raise e
        else:
            os.rename(temp_path, db_path)
            
        # Ensure all tables are created in the restored database (auto-schema upgrade)
        from app.db.session import engine as db_engine, Base
        Base.metadata.create_all(bind=db_engine)
            
        # Log this administrative restore action in the database (will use new connection)
        # We need to open a temporary session for logging
        from app.db.session import SessionLocal
        log_db = SessionLocal()
        try:
            log_action(log_db, current_user.id, "RESTORE_DATABASE", "system", db_path)
        except Exception:
            pass
        finally:
            log_db.close()

        return {
            "status": "success",
            "message": "Banco de dados restaurado com sucesso! Os dados foram atualizados."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Falha crítica ao restaurar o banco de dados: {str(e)}"
        )

@router.get("/ip")
def get_local_ip(
    current_user: User = Depends(get_current_user)
):
    """
    Get the server's local network IP address to display connection instructions.
    """
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Use a dummy connection (doesn't send data) to resolve local IP
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return {"local_ip": ip}
    except Exception:
        return {"local_ip": "127.0.0.1"}

