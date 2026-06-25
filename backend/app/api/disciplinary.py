from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import DisciplinaryAction, Employee, Leave, User
from app.schemas.all_schemas import DisciplinaryActionCreate, DisciplinaryActionResponse, LeaveCreate, LeaveResponse
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(tags=["disciplinary_and_leaves"])

# ----------------- Disciplinary Endpoints -----------------

from app.api.employees import check_employee_group

@router.post("/disciplinary", response_model=DisciplinaryActionResponse)
def create_disciplinary_action(
    action_in: DisciplinaryActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    emp = check_employee_group(db, action_in.employee_id, current_user)
        
    db_action = DisciplinaryAction(
        employee_id=action_in.employee_id,
        type=action_in.type,
        action_date=action_in.action_date,
        details=action_in.details,
        duration_days=action_in.duration_days,
        reason=action_in.reason,
        manager_name=action_in.manager_name
    )
    db.add(db_action)
    
    # If the disciplinary action type is a termination, change employee status to terminated
    if action_in.type == "termination":
        emp.status = "terminated"
        # Log career change
        from app.models.all_models import CareerHistory
        history = CareerHistory(
            employee_id=emp.id,
            changed_by_username=current_user.username,
            field_name="status",
            old_value=emp.status,
            new_value="terminated",
            reason=f"Desligamento Disciplinar: {action_in.reason}"
        )
        db.add(history)
        
    db.commit()
    db.refresh(db_action)
    
    log_action(
        db, 
        current_user.id, 
        f"CREATE_DISCIPLINARY_{action_in.type.upper()}", 
        "disciplinary_actions", 
        db_action.id,
        {"employee": emp.name, "type": action_in.type}
    )
    
    return db_action

@router.get("/disciplinary/employee/{employee_id}", response_model=List[DisciplinaryActionResponse])
def get_employee_disciplinary_actions(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_employee_group(db, employee_id, current_user)
    return db.query(DisciplinaryAction).filter(DisciplinaryAction.employee_id == employee_id).all()


# ----------------- Leaves (Afastamentos) Endpoints -----------------

@router.post("/leaves", response_model=LeaveResponse)
def create_leave(
    leave_in: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    emp = check_employee_group(db, leave_in.employee_id, current_user)
        
    db_leave = Leave(
        employee_id=leave_in.employee_id,
        start_date=leave_in.start_date,
        end_date=leave_in.end_date,
        reason=leave_in.reason
    )
    
    # Automatically update employee status to on_leave if current date falls within range
    # For simplicity, we can set status to "on_leave" immediately
    emp.status = "on_leave"
    
    # Log career change
    from app.models.all_models import CareerHistory
    history = CareerHistory(
        employee_id=emp.id,
        changed_by_username=current_user.username,
        field_name="status",
        old_value="active",
        new_value="on_leave",
        reason=f"Afastamento: {leave_in.reason}"
    )
    db.add(history)
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    
    log_action(
        db, 
        current_user.id, 
        "CREATE_LEAVE", 
        "leaves", 
        db_leave.id,
        {"employee": emp.name, "reason": leave_in.reason}
    )
    return db_leave

@router.get("/leaves/employee/{employee_id}", response_model=List[LeaveResponse])
def get_employee_leaves(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_employee_group(db, employee_id, current_user)
    return db.query(Leave).filter(Leave.employee_id == employee_id).all()

@router.delete("/disciplinary/{action_id}")
def delete_disciplinary_action(
    action_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    query = db.query(DisciplinaryAction).join(Employee).filter(DisciplinaryAction.id == action_id)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    action = query.first()
    if not action:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")
    db.delete(action)
    db.commit()
    log_action(db, current_user.id, "DELETE_DISCIPLINARY", "disciplinary_actions", action_id)
    return {"message": "Ocorrência excluída com sucesso."}

@router.delete("/leaves/{leave_id}")
def delete_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    query = db.query(Leave).join(Employee).filter(Leave.id == leave_id)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    leave = query.first()
    if not leave:
        raise HTTPException(status_code=404, detail="Afastamento não encontrado.")
    db.delete(leave)
    db.commit()
    log_action(db, current_user.id, "DELETE_LEAVE", "leaves", leave_id)
    return {"message": "Afastamento excluído com sucesso."}

@router.put("/disciplinary/{action_id}", response_model=DisciplinaryActionResponse)
def update_disciplinary_action(
    action_id: str,
    action_in: DisciplinaryActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    query = db.query(DisciplinaryAction).join(Employee).filter(DisciplinaryAction.id == action_id)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    action = query.first()
    if not action:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")
    action.type = action_in.type
    action.action_date = action_in.action_date
    action.details = action_in.details
    action.duration_days = action_in.duration_days
    action.reason = action_in.reason
    action.manager_name = action_in.manager_name
    db.commit()
    db.refresh(action)
    log_action(db, current_user.id, "UPDATE_DISCIPLINARY", "disciplinary_actions", action_id, {"reason": action_in.reason})
    return action

@router.put("/leaves/{leave_id}", response_model=LeaveResponse)
def update_leave(
    leave_id: str,
    leave_in: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"]))
):
    query = db.query(Leave).join(Employee).filter(Leave.id == leave_id)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    leave = query.first()
    if not leave:
        raise HTTPException(status_code=404, detail="Afastamento não encontrado.")
    leave.start_date = leave_in.start_date
    leave.end_date = leave_in.end_date
    leave.reason = leave_in.reason
    db.commit()
    db.refresh(leave)
    log_action(db, current_user.id, "UPDATE_LEAVE", "leaves", leave_id, {"reason": leave_in.reason})
    return leave


