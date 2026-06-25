import json
from sqlalchemy.orm import Session
from app.models.all_models import AuditLog

def log_action(
    db: Session,
    user_id: str | None,
    action: str,
    table_name: str | None = None,
    record_id: str | None = None,
    changed_fields: dict | None = None,
    group_id: str | None = None
) -> AuditLog:
    """
    Log an administrative action to the database.
    """
    fields_str = None
    if changed_fields is not None:
        try:
            fields_str = json.dumps(changed_fields)
        except Exception:
            fields_str = str(changed_fields)
            
    # Resolve group_id from user if not explicitly provided
    if not group_id and user_id:
        from app.models.all_models import User as DBUser
        user = db.query(DBUser).filter(DBUser.id == user_id).first()
        if user:
            group_id = user.group_id

    db_log = AuditLog(
        group_id=group_id,
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        changed_fields=fields_str
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
