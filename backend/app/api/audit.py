from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import AuditLog, User
from app.schemas.all_schemas import AuditLogResponse
from app.api.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "admin_delegado"]))
):
    """
    Retrieve all audit logs. Restricted to Administrator/Admin Delegado roles.
    """
    query = db.query(AuditLog)
    if current_user.role != "admin":
        query = query.filter(AuditLog.group_id == current_user.group_id)
        
    logs = query.order_by(AuditLog.timestamp.desc()).all()
    
    # Resolve username for each log
    results = []
    for log in logs:
        username = "Sistema"
        if log.user_id:
            user = db.query(User).filter(User.id == log.user_id).first()
            if user:
                username = user.username
                
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": username,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "changed_fields": log.changed_fields,
            "timestamp": log.timestamp
        })
        
    return results
