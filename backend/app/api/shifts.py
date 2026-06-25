from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Shift, Overtime, Employee, User
from app.schemas.all_schemas import ShiftBase, ShiftResponse, OvertimeCreate, OvertimeResponse, OvertimeUpdate
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(tags=["shifts_and_overtime"])

# ----------------- Shift Endpoints -----------------

@router.get("/shifts/employee/{employee_id}", response_model=ShiftResponse)
def get_employee_shift(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shift = db.query(Shift).join(Employee).filter(Shift.employee_id == employee_id, Employee.user_id == current_user.id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Jornada não cadastrada para este colaborador.")
    return shift

@router.put("/shifts/employee/{employee_id}", response_model=ShiftResponse)
def update_employee_shift(
    employee_id: str,
    shift_in: ShiftBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh"]))
):
    emp = db.query(Employee).filter(Employee.id == employee_id, Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    shift = db.query(Shift).filter(Shift.employee_id == employee_id).first()
    if not shift:
        # Create default shift if not exists
        shift = Shift(employee_id=employee_id)
        db.add(shift)
        
    shift.scale_type = shift_in.scale_type
    shift.entry_time = shift_in.entry_time
    shift.exit_time = shift_in.exit_time
    shift.interval_duration_minutes = shift_in.interval_duration_minutes
    shift.bank_of_hours_minutes = shift_in.bank_of_hours_minutes
    
    db.commit()
    db.refresh(shift)
    
    log_action(db, current_user.id, "UPDATE_SHIFT", "shifts", shift.id, {"employee_id": employee_id})
    return shift


# ----------------- Overtime Endpoints -----------------

@router.post("/overtime", response_model=OvertimeResponse)
def launch_overtime(
    overtime_in: OvertimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh"]))
):
    emp = db.query(Employee).filter(Employee.id == overtime_in.employee_id, Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
        
    # Calculate payment based on salary
    base_salary = emp.contract.base_salary if emp.contract else 1500.00
    hourly_rate = base_salary / 220.0  # standard divisor under Brazilian Labor Law
    
    # 50% rate
    rate_50 = hourly_rate * 1.5
    # 100% rate
    rate_100 = hourly_rate * 2.0
    # Night Shift + Overtime rate (night premium is 20% on top of 50% overtime rate, i.e., hourly_rate * 1.2 * 1.5)
    rate_night = hourly_rate * 1.2 * 1.5
    
    val_50 = (overtime_in.hours_50_minutes / 60.0) * rate_50
    val_100 = (overtime_in.hours_100_minutes / 60.0) * rate_100
    val_night = (overtime_in.hours_night_minutes / 60.0) * rate_night
    
    payment = round(val_50 + val_100 + val_night, 2)
    
    db_ot = Overtime(
        employee_id=overtime_in.employee_id,
        date=overtime_in.date,
        hours_50_minutes=overtime_in.hours_50_minutes,
        hours_100_minutes=overtime_in.hours_100_minutes,
        hours_night_minutes=overtime_in.hours_night_minutes,
        calculated_payment=payment,
        status="pending"
    )
    db.add(db_ot)
    db.commit()
    db.refresh(db_ot)
    
    log_action(
        db, 
        current_user.id, 
        "CREATE_OVERTIME", 
        "overtime", 
        db_ot.id, 
        {"employee": emp.name, "payment": payment}
    )
    return db_ot

@router.get("/overtime/employee/{employee_id}", response_model=List[OvertimeResponse])
def get_employee_overtime(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id, Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    return db.query(Overtime).filter(Overtime.employee_id == employee_id).all()

@router.put("/overtime/{overtime_id}", response_model=OvertimeResponse)
def update_overtime_status(
    overtime_id: str,
    status_update: OvertimeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh"]))
):
    ot = db.query(Overtime).join(Employee).filter(Overtime.id == overtime_id, Employee.user_id == current_user.id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="Lançamento de hora extra não encontrado.")
        
    old_status = ot.status
    ot.status = status_update.status
    db.commit()
    db.refresh(ot)
    
    log_action(
        db, 
        current_user.id, 
        "UPDATE_OVERTIME_STATUS", 
        "overtime", 
        ot.id, 
        {"status": [old_status, status_update.status]}
    )
    return ot

@router.delete("/overtime/{overtime_id}")
def delete_overtime(
    overtime_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh"]))
):
    ot = db.query(Overtime).join(Employee).filter(Overtime.id == overtime_id, Employee.user_id == current_user.id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="Lançamento de hora extra não encontrado.")
    db.delete(ot)
    db.commit()
    log_action(db, current_user.id, "DELETE_OVERTIME", "overtime", overtime_id)
    return {"message": "Lançamento de hora extra excluído com sucesso."}

@router.put("/overtime/{overtime_id}/edit", response_model=OvertimeResponse)
def edit_overtime(
    overtime_id: str,
    overtime_in: OvertimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh"]))
):
    ot = db.query(Overtime).join(Employee).filter(Overtime.id == overtime_id, Employee.user_id == current_user.id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="Lançamento de hora extra não encontrado.")
        
    emp = db.query(Employee).filter(Employee.id == overtime_in.employee_id, Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
        
    # Calculate payment based on salary
    base_salary = emp.contract.base_salary if emp.contract else 1500.00
    hourly_rate = base_salary / 220.0  # standard divisor under Brazilian Labor Law
    
    rate_50 = hourly_rate * 1.5
    rate_100 = hourly_rate * 2.0
    rate_night = hourly_rate * 1.2 * 1.5
    
    val_50 = (overtime_in.hours_50_minutes / 60.0) * rate_50
    val_100 = (overtime_in.hours_100_minutes / 60.0) * rate_100
    val_night = (overtime_in.hours_night_minutes / 60.0) * rate_night
    
    payment = round(val_50 + val_100 + val_night, 2)
    
    ot.date = overtime_in.date
    ot.hours_50_minutes = overtime_in.hours_50_minutes
    ot.hours_100_minutes = overtime_in.hours_100_minutes
    ot.hours_night_minutes = overtime_in.hours_night_minutes
    ot.calculated_payment = payment
    ot.status = overtime_in.status
    
    db.commit()
    db.refresh(ot)
    
    log_action(db, current_user.id, "EDIT_OVERTIME", "overtime", overtime_id, {"payment": payment})
    return ot


