from datetime import date, datetime
from typing import Optional
from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Employee, Contract, DisciplinaryAction, Overtime, User, Leave
from app.api.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
def get_dashboard_data(
    employee_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import calendar
    today = date.today()
    if year is None:
        year = today.year
        
    # Determine the date range of the selected period
    if month is not None:
        _, last_day = calendar.monthrange(year, month)
        period_start = date(year, month, 1)
        period_end = date(year, month, last_day)
        birthday_month = month
    else:
        period_start = date(year, 1, 1)
        period_end = date(year, 12, 31)
        birthday_month = today.month  # default to current month for birthdays in yearly view

    # Helper function to check if employee was active at period_end
    def is_employee_active_at(emp, end_date):
        if not emp.contract:
            return False
        # Admitted on or before end_date
        if emp.contract.admission_date > end_date:
            return False
        
        # If terminated, check if termination was after end_date
        if emp.status == "terminated":
            term_action = db.query(DisciplinaryAction).filter(
                DisciplinaryAction.employee_id == emp.id,
                DisciplinaryAction.type == "termination"
            ).first()
            if term_action and term_action.action_date <= end_date:
                return False
        return True

    # Helper function to check if employee was on leave during period
    def is_employee_on_leave_during(emp, start_date, end_date):
        # Check if there is an overlapping leave
        leave = db.query(Leave).filter(
            Leave.employee_id == emp.id,
            Leave.start_date <= end_date,
            Leave.end_date >= start_date
        ).first()
        return leave is not None

    if employee_id:
        emp_query = db.query(Employee).filter(Employee.id == employee_id)
        if current_user.role != "admin":
            emp_query = emp_query.filter(Employee.group_id == current_user.group_id)
        emp = emp_query.first()
        if not emp:
            return {"error": "Colaborador não encontrado."}
            
        status_label = "Ativo" if emp.status == "active" else "Afastado" if emp.status == "on_leave" else "Desligado"
        salary = float(emp.contract.base_salary) if emp.contract else 0.0
        
        warnings_query = db.query(func.count(DisciplinaryAction.id)).filter(
            DisciplinaryAction.employee_id == employee_id, 
            DisciplinaryAction.type == "warning",
            DisciplinaryAction.action_date >= period_start,
            DisciplinaryAction.action_date <= period_end
        )
        warnings_count = warnings_query.scalar() or 0
        
        suspensions_query = db.query(func.count(DisciplinaryAction.id)).filter(
            DisciplinaryAction.employee_id == employee_id, 
            DisciplinaryAction.type == "suspension",
            DisciplinaryAction.action_date >= period_start,
            DisciplinaryAction.action_date <= period_end
        )
        suspensions_count = suspensions_query.scalar() or 0
        
        ot_query = db.query(func.sum(
            Overtime.hours_50_minutes + Overtime.hours_100_minutes + Overtime.hours_night_minutes
        )).filter(
            Overtime.employee_id == employee_id,
            Overtime.date >= period_start,
            Overtime.date <= period_end
        )
        total_ot_minutes = ot_query.scalar() or 0
        total_ot_hours = round(total_ot_minutes / 60.0, 1)
        
        leaves_query = db.query(func.count(Leave.id)).filter(
            Leave.employee_id == employee_id,
            Leave.start_date <= period_end,
            Leave.end_date >= period_start
        )
        leaves_count = leaves_query.scalar() or 0
        
        is_birthday_this_month = emp.dob.month == today.month if emp.dob else False
        scale_type = emp.shift.scale_type if emp.shift else "N/A"
        
        return {
            "is_individual": True,
            "employee": {
                "id": emp.id,
                "name": emp.name,
                "registration_number": emp.registration_number,
                "status": emp.status,
                "status_label": status_label,
                "role": emp.contract.role if emp.contract else "N/A",
                "department": emp.contract.department if emp.contract else "N/A",
                "admission_date": emp.contract.admission_date.strftime("%d/%m/%Y") if emp.contract and emp.contract.admission_date else "N/A",
                "dob": emp.dob.strftime("%d/%m") if emp.dob else "N/A",
                "is_birthday_this_month": is_birthday_this_month,
                "scale_type": scale_type
            },
            "kpis": {
                "salary": salary,
                "warnings_count": warnings_count,
                "suspensions_count": suspensions_count,
                "overtime_hours": total_ot_hours,
                "leaves_count": leaves_count
            }
        }
        
    # General metrics calculation
    query_emp = db.query(Employee)
    if current_user.role != "admin":
        query_emp = query_emp.filter(Employee.group_id == current_user.group_id)
    all_employees = query_emp.all()
    
    active_in_period = []
    on_leave_in_period = []
    terminated_in_period = []
    
    for emp in all_employees:
        # 1. Terminated during period
        if emp.status == "terminated":
            term_action = db.query(DisciplinaryAction).filter(
                DisciplinaryAction.employee_id == emp.id,
                DisciplinaryAction.type == "termination"
            ).first()
            if term_action and period_start <= term_action.action_date <= period_end:
                terminated_in_period.append(emp)
                continue
                
        # 2. Active at period_end
        if is_employee_active_at(emp, period_end):
            if is_employee_on_leave_during(emp, period_start, period_end):
                on_leave_in_period.append(emp)
            else:
                active_in_period.append(emp)

    total_active = len(active_in_period)
    total_on_leave = len(on_leave_in_period)
    
    # If filtering a specific month or non-current year, show who was terminated in that period.
    # Otherwise show current terminated count.
    if year != today.year or month is not None:
        total_terminated = len(terminated_in_period)
    else:
        query_term = db.query(func.count(Employee.id)).filter(Employee.status == "terminated")
        if current_user.role != "admin":
            query_term = query_term.filter(Employee.group_id == current_user.group_id)
        total_terminated = query_term.scalar() or 0
    
    salaries = [emp.contract.base_salary for emp in active_in_period if emp.contract]
    average_salary = round(sum(salaries) / len(salaries), 2) if salaries else 0.0
    
    warnings_query = db.query(func.count(DisciplinaryAction.id)).join(Employee).filter(
        DisciplinaryAction.type == "warning",
        DisciplinaryAction.action_date >= period_start,
        DisciplinaryAction.action_date <= period_end
    )
    if current_user.role != "admin":
        warnings_query = warnings_query.filter(Employee.group_id == current_user.group_id)
    warnings_count = warnings_query.scalar() or 0
    
    suspensions_query = db.query(func.count(DisciplinaryAction.id)).join(Employee).filter(
        DisciplinaryAction.type == "suspension",
        DisciplinaryAction.action_date >= period_start,
        DisciplinaryAction.action_date <= period_end
    )
    if current_user.role != "admin":
        suspensions_query = suspensions_query.filter(Employee.group_id == current_user.group_id)
    suspensions_count = suspensions_query.scalar() or 0
    
    total_disciplinary = warnings_count + suspensions_count
    
    total_ot_query = db.query(func.sum(
        Overtime.hours_50_minutes + Overtime.hours_100_minutes + Overtime.hours_night_minutes
    )).join(Employee).filter(
        Overtime.date >= period_start,
        Overtime.date <= period_end
    )
    if current_user.role != "admin":
        total_ot_query = total_ot_query.filter(Employee.group_id == current_user.group_id)
    total_ot_minutes = total_ot_query.scalar() or 0
    total_ot_hours = round(total_ot_minutes / 60.0, 1)
    
    birthdays = []
    active_list = [emp for emp in all_employees if emp.status != "terminated"]
    for emp in active_list:
        if emp.dob and emp.dob.month == birthday_month:
            birthdays.append({
                "id": emp.id,
                "name": emp.name,
                "dob": emp.dob.strftime("%d/%m"),
                "phone": emp.phone,
                "department": emp.contract.department if emp.contract else "N/A"
            })
            
    birthdays = sorted(birthdays, key=lambda x: int(x["dob"].split("/")[0]))
            
    dept_counts = {}
    role_counts = {}
    
    for emp in (active_in_period + on_leave_in_period):
        if emp.contract:
            dept = emp.contract.department or "Não Especificado"
            role = emp.contract.role or "Não Especificado"
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
            role_counts[role] = role_counts.get(role, 0) + 1
            
    by_department = [{"name": k, "count": v} for k, v in dept_counts.items()]
    by_role = [{"name": k, "count": v} for k, v in role_counts.items()]
    
    if db.bind.name == "sqlite":
        admissions_query = db.query(func.count(Contract.id)).join(Employee).filter(
            func.strftime("%Y", Contract.admission_date) == str(year)
        )
        if month is not None:
            admissions_query = admissions_query.filter(
                func.strftime("%m", Contract.admission_date) == f"{month:02d}"
            )
    else:
        admissions_query = db.query(func.count(Contract.id)).join(Employee).filter(
            func.extract("year", Contract.admission_date) == year
        )
        if month is not None:
            admissions_query = admissions_query.filter(
                func.extract("month", Contract.admission_date) == month
            )
            
    if current_user.role != "admin":
        admissions_query = admissions_query.filter(Employee.group_id == current_user.group_id)
            
    admissions_year = admissions_query.scalar() or 0
    
    return {
        "kpis": {
            "active_employees": total_active,
            "on_leave_employees": total_on_leave,
            "terminated_employees": total_terminated,
            "average_salary": average_salary,
            "total_disciplinary": total_disciplinary,
            "warnings_count": warnings_count,
            "suspensions_count": suspensions_count,
            "overtime_hours": total_ot_hours,
            "admissions_this_year": admissions_year
        },
        "birthdays": birthdays[:10],
        "charts": {
            "by_department": by_department,
            "by_role": by_role
        }
    }


