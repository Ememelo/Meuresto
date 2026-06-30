import os
import shutil
import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.all_models import Employee, Contract, Shift, Dependent, CareerHistory, User, Group, Sector, JobPosition, WorkScale, EmployeeDocument
from app.schemas.all_schemas import EmployeeCreate, EmployeeResponse, EmployeeListResponse, EmployeeUpdate, CareerHistoryResponse, DependentCreate, DependentResponse, EmployeeDocumentResponse
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/employees", tags=["employees"])

# Helper to check employee group isolation
def check_employee_group(db: Session, employee_id: str, current_user: User) -> Employee:
    query = db.query(Employee).filter(Employee.id == employee_id)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    emp = query.first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    return emp

# Helper to log career history changes
def log_career(db: Session, employee_id: str, username: str, field: str, old_val: str, new_val: str, reason: str | None):
    history = CareerHistory(
        employee_id=employee_id,
        changed_by_username=username,
        field_name=field,
        old_value=old_val,
        new_value=new_val,
        reason=reason or "Alteração cadastral"
    )
    db.add(history)

# Helper to sync employee status based on active leaves
def sync_employee_status_by_id(db: Session, employee_id: str):
    from datetime import date
    from app.models.all_models import Leave
    
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp or emp.status == "terminated":
        return
        
    today = date.today()
    active_leave = db.query(Leave).filter(
        Leave.employee_id == employee_id,
        Leave.start_date <= today,
        Leave.end_date >= today
    ).first()
    
    expected_status = "on_leave" if active_leave else "active"
    if emp.status != expected_status:
        emp.status = expected_status
        db.add(emp)
        db.commit()

# List Employees with Search & Filters
@router.get("", response_model=List[EmployeeListResponse])
def list_employees(
    search: Optional[str] = None,
    department: Optional[str] = None,
    status_filter: Optional[str] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Employee)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(Employee.group_id == group_id)
    
    if search:
        query = query.filter(
            (Employee.name.ilike(f"%{search}%")) | 
            (Employee.registration_number.ilike(f"%{search}%")) |
            (Employee.cpf.like(f"%{search}%"))
        )
    
    if status_filter:
        query = query.filter(Employee.status == status_filter)
        
    employees = query.all()
    
    # Format response with nested contract data
    results = []
    for emp in employees:
        sync_employee_status_by_id(db, emp.id)
        contract_role = emp.contract.role if emp.contract else None
        contract_dept = emp.contract.department if emp.contract else None
        contract_adm = emp.contract.admission_date if emp.contract else None
        
        # Apply department filter post-query or in query (easier in query, but database structure has it in joined table)
        if department and contract_dept != department:
            continue
            
        results.append({
            "id": emp.id,
            "registration_number": emp.registration_number,
            "name": emp.name,
            "cpf": emp.cpf,
            "status": emp.status,
            "role": contract_role,
            "department": contract_dept,
            "admission_date": contract_adm
        })
        
    return results

# Get next registration number
@router.get("/next-registration")
def get_next_registration(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "admin_delegado", "rh"], required_permission="has_hr_access"))
):
    registrations = db.query(Employee.registration_number).all()
    max_num = 0
    for (reg,) in registrations:
        if reg and reg.startswith('F'):
            try:
                num = int(reg[1:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    next_num = max_num + 1
    return {"registration_number": f"F{next_num:04d}"}

# Get single employee details
@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sync_employee_status_by_id(db, employee_id)
    return check_employee_group(db, employee_id, current_user)

# Create employee (RH, Admin Master, or Admin Delegado)
@router.post("", response_model=EmployeeResponse)
def create_employee(
    emp_in: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    # Auto-generate or check registration number
    reg_num = emp_in.registration_number
    if not reg_num:
        registrations = db.query(Employee.registration_number).all()
        max_num = 0
        for (reg,) in registrations:
            if reg and reg.startswith('F'):
                try:
                    num = int(reg[1:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        reg_num = f"F{max_num + 1:04d}"

    # Determine group_id
    if current_user.role == "admin":
        # Admin master can specify group_id or fallback to default
        if emp_in.group_id:
            group_id_to_set = emp_in.group_id
        else:
            default_group = db.query(Group).first()
            group_id_to_set = default_group.id if default_group else None
    else:
        # Others use current_user's group_id
        group_id_to_set = current_user.group_id

    # Check duplicate CPF or Registration Number within the group
    query_exist = db.query(Employee).filter(
        (Employee.cpf == emp_in.cpf) | 
        (Employee.registration_number == reg_num)
    )
    if group_id_to_set:
        query_exist = query_exist.filter(Employee.group_id == group_id_to_set)
    existing = query_exist.first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Colaborador com este CPF ou Matrícula já está cadastrado nesta empresa/grupo."
        )
        
    role_name = emp_in.contract.role
    dept_name = emp_in.contract.department
    
    if emp_in.contract.job_position_id:
        jp = db.query(JobPosition).filter(JobPosition.id == emp_in.contract.job_position_id).first()
        if jp:
            role_name = jp.name
            
    if emp_in.contract.sector_id:
        sec = db.query(Sector).filter(Sector.id == emp_in.contract.sector_id).first()
        if sec:
            dept_name = sec.name

    db_emp = Employee(
        group_id=group_id_to_set,
        user_id=current_user.id,
        registration_number=reg_num,
        name=emp_in.name,
        cpf=emp_in.cpf,
        rg=emp_in.rg,
        dob=emp_in.dob,
        civil_status=emp_in.civil_status,
        nationality=emp_in.nationality,
        email=emp_in.email,
        phone=emp_in.phone,
        address_cep=emp_in.address_cep,
        address_street=emp_in.address_street,
        address_number=emp_in.address_number,
        address_complement=emp_in.address_complement,
        address_neighborhood=emp_in.address_neighborhood,
        address_city=emp_in.address_city,
        address_state=emp_in.address_state,
        mother_name=emp_in.mother_name,
        father_name=emp_in.father_name,
        has_disability=emp_in.has_disability,
        disability_details=emp_in.disability_details,
        education=emp_in.education,
        ctps=emp_in.ctps,
        pis=emp_in.pis,
        reservista=emp_in.reservista,
        sex=emp_in.sex,
        bank_name=emp_in.bank_name,
        bank_agency=emp_in.bank_agency,
        bank_account=emp_in.bank_account,
        pix_key=emp_in.pix_key,
        notes=emp_in.notes,
        status="active"
    )
    db.add(db_emp)
    db.flush() # Populate db_emp.id
    
    # Create Contract
    db_contract = Contract(
        employee_id=db_emp.id,
        admission_date=emp_in.contract.admission_date,
        role=role_name,
        department=dept_name,
        manager_name=emp_in.contract.manager_name,
        base_salary=emp_in.contract.base_salary,
        benefits=emp_in.contract.benefits,
        job_position_id=emp_in.contract.job_position_id,
        sector_id=emp_in.contract.sector_id,
        work_scale_id=emp_in.contract.work_scale_id,
        contract_type=emp_in.contract.contract_type or "CLT",
        status=emp_in.contract.status or "Experiência"
    )
    db.add(db_contract)
    
    # Create Shift (if provided, otherwise default)
    shift_data = emp_in.shift or Shift(employee_id=db_emp.id)
    db_shift = Shift(
        employee_id=db_emp.id,
        scale_type=shift_data.scale_type,
        entry_time=shift_data.entry_time,
        exit_time=shift_data.exit_time,
        interval_duration_minutes=shift_data.interval_duration_minutes,
        bank_of_hours_minutes=shift_data.bank_of_hours_minutes
    )
    db.add(db_shift)
    
    # Create Dependents
    for dep in emp_in.dependents:
        db_dep = Dependent(
            employee_id=db_emp.id,
            name=dep.name,
            relationship=dep.relationship,
            dob=dep.dob
        )
        db.add(db_dep)
        
    # Log initial career values
    log_career(db, db_emp.id, current_user.username, "salary", "N/A", str(db_contract.base_salary), "Admissão")
    log_career(db, db_emp.id, current_user.username, "role", "N/A", db_contract.role, "Admissão")
    log_career(db, db_emp.id, current_user.username, "department", "N/A", db_contract.department, "Admissão")
    
    db.commit()
    db.refresh(db_emp)
    
    log_action(db, current_user.id, "CREATE_EMPLOYEE", "employees", db_emp.id, {"name": db_emp.name})
    
    return db_emp

# Update Employee and trigger career logging (RH, Admin Master, or Admin Delegado)
@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: str,
    emp_update: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    db_emp = check_employee_group(db, employee_id, current_user)
    if not db_emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
        
    # Track changed fields for audit log
    audit_changes = {}
    
    # Update personal details
    personal_fields = [
        "name", "rg", "cpf", "dob", "civil_status", "nationality", "email", "phone",
        "address_cep", "address_street", "address_number", "address_complement",
        "address_neighborhood", "address_city", "address_state", "mother_name", "father_name",
        "has_disability", "disability_details", "education", "ctps", "pis", "reservista",
        "sex", "bank_name", "bank_agency", "bank_account", "pix_key", "notes",
        "termination_date", "termination_reason"
    ]
    
    for field in personal_fields:
        val = getattr(emp_update, field)
        if val is not None:
            old_val = getattr(db_emp, field)
            if old_val != val:
                audit_changes[field] = [str(old_val), str(val)]
                setattr(db_emp, field, val)
                
    # Handle status changes
    if emp_update.status is not None and emp_update.status != db_emp.status:
        log_career(db, employee_id, current_user.username, "status", db_emp.status, emp_update.status, emp_update.reason_for_change)
        audit_changes["status"] = [db_emp.status, emp_update.status]
        db_emp.status = emp_update.status
        if emp_update.status == "terminated":
            db_emp.termination_date = emp_update.termination_date or datetime.utcnow().date()
            db_emp.termination_reason = emp_update.termination_reason or emp_update.reason_for_change
        
    # Update Contract and check career history triggers
    if db_emp.contract:
        if emp_update.job_position_id is not None:
            db_emp.contract.job_position_id = emp_update.job_position_id
            jp = db.query(JobPosition).filter(JobPosition.id == emp_update.job_position_id).first()
            if jp and jp.name != db_emp.contract.role:
                log_career(db, employee_id, current_user.username, "role", db_emp.contract.role, jp.name, emp_update.reason_for_change)
                audit_changes["role"] = [db_emp.contract.role, jp.name]
                db_emp.contract.role = jp.name
        elif emp_update.role is not None and emp_update.role != db_emp.contract.role:
            log_career(db, employee_id, current_user.username, "role", db_emp.contract.role, emp_update.role, emp_update.reason_for_change)
            audit_changes["role"] = [db_emp.contract.role, emp_update.role]
            db_emp.contract.role = emp_update.role
            
        if emp_update.sector_id is not None:
            db_emp.contract.sector_id = emp_update.sector_id
            sec = db.query(Sector).filter(Sector.id == emp_update.sector_id).first()
            if sec and sec.name != db_emp.contract.department:
                log_career(db, employee_id, current_user.username, "department", db_emp.contract.department, sec.name, emp_update.reason_for_change)
                audit_changes["department"] = [db_emp.contract.department, sec.name]
                db_emp.contract.department = sec.name
        elif emp_update.department is not None and emp_update.department != db_emp.contract.department:
            log_career(db, employee_id, current_user.username, "department", db_emp.contract.department, emp_update.department, emp_update.reason_for_change)
            audit_changes["department"] = [db_emp.contract.department, emp_update.department]
            db_emp.contract.department = emp_update.department
            
        if emp_update.base_salary is not None and emp_update.base_salary != db_emp.contract.base_salary:
            log_career(db, employee_id, current_user.username, "salary", str(db_emp.contract.base_salary), str(emp_update.base_salary), emp_update.reason_for_change)
            audit_changes["base_salary"] = [db_emp.contract.base_salary, emp_update.base_salary]
            db_emp.contract.base_salary = emp_update.base_salary
            
        if emp_update.manager_name is not None:
            db_emp.contract.manager_name = emp_update.manager_name
        if emp_update.benefits is not None:
            db_emp.contract.benefits = emp_update.benefits
        if emp_update.work_scale_id is not None:
            db_emp.contract.work_scale_id = emp_update.work_scale_id
        if emp_update.contract_type is not None:
            db_emp.contract.contract_type = emp_update.contract_type
        if emp_update.contract_status is not None:
            db_emp.contract.status = emp_update.contract_status
            
    db.commit()
    db.refresh(db_emp)
    
    if audit_changes:
        log_action(db, current_user.id, "UPDATE_EMPLOYEE", "employees", db_emp.id, audit_changes)
        
    return db_emp

# Upload Profile Photo (RH, Admin Master, or Admin Delegado)
@router.post("/{employee_id}/upload-photo")
def upload_photo(
    employee_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
        
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use JPG ou PNG.")
        
    # Save file
    filename = f"{employee_id}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, "photos", filename)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    emp.photo_path = f"/uploads/photos/{filename}"
    db.commit()
    
    log_action(db, current_user.id, "UPLOAD_PHOTO", "employees", employee_id)
    return {"photo_url": emp.photo_path}
# Get Employee Career History Logs
@router.get("/{employee_id}/history", response_model=List[CareerHistoryResponse])
def get_employee_career_history(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_employee_group(db, employee_id, current_user)
    return db.query(CareerHistory).filter(CareerHistory.employee_id == employee_id).order_by(CareerHistory.change_date.desc()).all()

# Delete Employee (Physical Delete) - (Admin Master, Admin Delegado or RH)
@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    
    # Physical delete
    name = emp.name
    db.delete(emp)
    db.commit()
    
    log_action(db, current_user.id, "DELETE_EMPLOYEE", "employees", employee_id, {"name": name})
    return {"message": f"Cadastro do colaborador '{name}' excluído permanentemente com sucesso."}

@router.delete("/dependent/{dependent_id}")
def delete_dependent(
    dependent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    query_dep = db.query(Dependent).join(Employee).filter(Dependent.id == dependent_id)
    if current_user.role != "admin":
        query_dep = query_dep.filter(Employee.group_id == current_user.group_id)
    dep = query_dep.first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependente não encontrado.")
    db.delete(dep)
    db.commit()
    log_action(db, current_user.id, "DELETE_DEPENDENT", "dependents", dependent_id)
    return {"message": "Dependente excluído com sucesso."}

@router.post("/{employee_id}/dependent", response_model=DependentResponse)
def add_dependent(
    employee_id: str,
    dep_in: DependentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    db_dep = Dependent(
        employee_id=employee_id,
        name=dep_in.name,
        relationship=dep_in.relationship,
        dob=dep_in.dob
    )
    db.add(db_dep)
    db.commit()
    db.refresh(db_dep)
    log_action(db, current_user.id, "ADD_DEPENDENT", "dependents", db_dep.id)
    return db_dep

@router.put("/dependent/{dependent_id}", response_model=DependentResponse)
def update_dependent(
    dependent_id: str,
    dep_in: DependentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    query_dep = db.query(Dependent).join(Employee).filter(Dependent.id == dependent_id)
    if current_user.role != "admin":
        query_dep = query_dep.filter(Employee.group_id == current_user.group_id)
    dep = query_dep.first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependente não encontrado.")
    dep.name = dep_in.name
    dep.relationship = dep_in.relationship
    dep.dob = dep_in.dob
    db.commit()
    db.refresh(dep)
    log_action(db, current_user.id, "UPDATE_DEPENDENT", "dependents", dependent_id)
    return dep


# List Employee Documents
@router.get("/{employee_id}/documents", response_model=List[EmployeeDocumentResponse])
def list_employee_documents(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_employee_group(db, employee_id, current_user)
    return db.query(EmployeeDocument).filter(EmployeeDocument.employee_id == employee_id).all()


# Create/Upload Employee Document
@router.post("/{employee_id}/documents", response_model=EmployeeDocumentResponse)
def upload_employee_document(
    employee_id: str,
    document_type: str = Form(...),
    status: str = Form("Pendente"),
    due_date: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    
    parsed_due_date = None
    if due_date and due_date != "null" and due_date != "":
        try:
            parsed_due_date = date.fromisoformat(due_date)
        except ValueError:
            pass

    file_path = None
    if file:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc"]:
            raise HTTPException(status_code=400, detail="Formato de arquivo inválido.")
            
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "documents"), exist_ok=True)
        filename = f"{employee_id}_{uuid.uuid4().hex}{ext}"
        dest_path = os.path.join(settings.UPLOAD_DIR, "documents", filename)
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_path = f"/uploads/documents/{filename}"

    from datetime import datetime
    db_doc = EmployeeDocument(
        employee_id=employee_id,
        document_type=document_type,
        file_path=file_path,
        status=status,
        due_date=parsed_due_date,
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    log_action(db, current_user.id, "UPLOAD_DOCUMENT", "employee_documents", db_doc.id, {"document_type": document_type})
    return db_doc


# Update Employee Document
@router.put("/{employee_id}/documents/{document_id}", response_model=EmployeeDocumentResponse)
def update_employee_document(
    employee_id: str,
    document_id: str,
    document_type: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    db_doc = db.query(EmployeeDocument).filter(
        EmployeeDocument.id == document_id, 
        EmployeeDocument.employee_id == employee_id
    ).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
        
    if document_type is not None:
        db_doc.document_type = document_type
    if status is not None:
        db_doc.status = status
    if due_date is not None:
        if due_date == "null" or due_date == "":
            db_doc.due_date = None
        else:
            try:
                db_doc.due_date = date.fromisoformat(due_date)
            except ValueError:
                pass
                
    if file:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc"]:
            raise HTTPException(status_code=400, detail="Formato de arquivo inválido.")
            
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "documents"), exist_ok=True)
        filename = f"{employee_id}_{uuid.uuid4().hex}{ext}"
        dest_path = os.path.join(settings.UPLOAD_DIR, "documents", filename)
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Delete old file if exists
        if db_doc.file_path:
            old_file = os.path.join(settings.UPLOAD_DIR, "..", db_doc.file_path.lstrip("/"))
            if os.path.exists(old_file):
                try:
                    os.remove(old_file)
                except Exception:
                    pass
                    
        db_doc.file_path = f"/uploads/documents/{filename}"
        
    from datetime import datetime
    db_doc.updated_by = current_user.username
    db_doc.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_doc)
    log_action(db, current_user.id, "UPDATE_DOCUMENT", "employee_documents", document_id)
    return db_doc


# Delete Employee Document
@router.delete("/{employee_id}/documents/{document_id}")
def delete_employee_document(
    employee_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access"))
):
    emp = check_employee_group(db, employee_id, current_user)
    db_doc = db.query(EmployeeDocument).filter(
        EmployeeDocument.id == document_id, 
        EmployeeDocument.employee_id == employee_id
    ).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
        
    if db_doc.file_path:
        old_file = os.path.join(settings.UPLOAD_DIR, "..", db_doc.file_path.lstrip("/"))
        if os.path.exists(old_file):
            try:
                os.remove(old_file)
            except Exception:
                pass
                
    db.delete(db_doc)
    db.commit()
    log_action(db, current_user.id, "DELETE_DOCUMENT", "employee_documents", document_id)
    return {"message": "Documento excluído com sucesso."}


@router.get("/{employee_id}/worked-time")
def get_employee_worked_time(
    employee_id: str,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import extract, func
    from datetime import date, timedelta
    from app.models.all_models import Overtime, Leave, Contract, WorkScale
    
    db_emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    if current_user.role != "admin" and db_emp.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    contract = db_emp.contract
    base_salary = contract.base_salary if contract else 0.0
    
    daily_hours = 8.0
    weekly_hours = 44.0
    monthly_hours = 220.0
    scale_name = "Não definida"

    if contract and contract.work_scale:
        scale = contract.work_scale
        scale_name = scale.name
        try:
            ent_h, ent_m = map(int, scale.entry_time.split(":"))
            ex_h, ex_m = map(int, scale.exit_time.split(":"))
            total_min = (ex_h * 60 + ex_m) - (ent_h * 60 + ent_m) - scale.interval_minutes
            daily_hours = max(0.0, total_min / 60.0)
        except Exception:
            daily_hours = 8.0

        days_per_week = 5
        desc = (scale.description or "").lower() + " " + scale.name.lower()
        if "6x1" in desc:
            days_per_week = 6
        elif "12x36" in desc:
            days_per_week = 3.5
            
        weekly_hours = daily_hours * days_per_week
        monthly_hours = weekly_hours * 5.0

    overtimes = db.query(Overtime).filter(
        Overtime.employee_id == employee_id,
        Overtime.status.in_(["approved", "paid"]),
        extract("year", Overtime.date) == year,
        extract("month", Overtime.date) == month
    ).all()

    total_ot_min = sum(ot.hours_50_minutes + ot.hours_100_minutes + ot.hours_night_minutes for ot in overtimes)
    total_ot_hours = total_ot_min / 60.0
    total_ot_payment = sum(ot.calculated_payment for ot in overtimes)

    leaves = db.query(Leave).filter(
        Leave.employee_id == employee_id,
        func.lower(Leave.reason).contains("falta"),
        extract("year", Leave.start_date) == year,
        extract("month", Leave.start_date) == month
    ).all()

    absent_days = 0
    for leave in leaves:
        start = max(leave.start_date, date(year, month, 1))
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        end = min(leave.end_date, last_day)
        
        if end >= start:
            absent_days += (end - start).days + 1

    absence_hours = absent_days * daily_hours
    absence_discount = (base_salary / 30.0) * absent_days

    actual_worked_hours = max(0.0, monthly_hours + total_ot_hours - absence_hours)

    return {
        "daily_hours": round(daily_hours, 1),
        "weekly_hours": round(weekly_hours, 1),
        "monthly_hours": round(monthly_hours, 1),
        "scale_name": scale_name,
        "overtime_hours": round(total_ot_hours, 2),
        "overtime_payment": round(total_ot_payment, 2),
        "absent_days": absent_days,
        "absence_hours": round(absence_hours, 1),
        "absence_discount": round(absence_discount, 2),
        "actual_worked_hours": round(actual_worked_hours, 2),
        "base_salary": base_salary
    }



