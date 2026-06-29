import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.db.session import Base

# Alias to avoid naming collisions in classes with a 'relationship' column
_relationship = relationship


class Group(Base):
    __tablename__ = "groups"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="group")
    employees = relationship("Employee", back_populates="group")
    revenues = relationship("FinancialRevenue", back_populates="group")
    expenses = relationship("FinancialExpense", back_populates="group")
    audit_logs = relationship("AuditLog", back_populates="group")
    suppliers = relationship("Supplier", back_populates="group")
    sectors = relationship("Sector", back_populates="group")
    job_positions = relationship("JobPosition", back_populates="group")
    work_scales = relationship("WorkScale", back_populates="group")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="consulta", nullable=False)  # admin, admin_delegado, rh, socio, gestor, consulta
    is_active = Column(Boolean, default=True, nullable=False)
    password_reset_requested = Column(Boolean, default=False, nullable=False)
    has_financial_access = Column(Boolean, default=False, nullable=False)
    has_suppliers_access = Column(Boolean, default=False, nullable=False)
    has_reports_access = Column(Boolean, default=False, nullable=False)
    has_hr_access = Column(Boolean, default=False, nullable=False)
    financial_access = Column(String(20), default="none", nullable=False)
    suppliers_access = Column(String(20), default="none", nullable=False)
    hr_access = Column(String(20), default="none", nullable=False)
    reports_access = Column(String(20), default="none", nullable=False)
    
    # Relationships
    group = relationship("Group", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    registration_number = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    cpf = Column(String(14), unique=True, nullable=False, index=True)
    rg = Column(String(20), nullable=False)
    dob = Column(Date, nullable=False)
    civil_status = Column(String(20), nullable=False)
    nationality = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    
    # Address
    address_cep = Column(String(9), nullable=False)
    address_street = Column(String(150), nullable=False)
    address_number = Column(String(20), nullable=False)
    address_complement = Column(String(100), nullable=True)
    address_neighborhood = Column(String(50), nullable=False)
    address_city = Column(String(50), nullable=False)
    address_state = Column(String(2), nullable=False)
    
    # Parents
    mother_name = Column(String(100), nullable=False)
    father_name = Column(String(100), nullable=True)
    
    # Other
    photo_path = Column(String(255), nullable=True)
    has_disability = Column(Boolean, default=False, nullable=False)
    disability_details = Column(String(255), nullable=True)
    education = Column(String(50), nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, on_leave, terminated
    
    ctps = Column(String(30), nullable=True)
    pis = Column(String(30), nullable=True)
    reservista = Column(String(30), nullable=True)
    sex = Column(String(20), nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_agency = Column(String(20), nullable=True)
    bank_account = Column(String(30), nullable=True)
    pix_key = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    group = relationship("Group", back_populates="employees")
    dependents = relationship("Dependent", back_populates="employee", cascade="all, delete-orphan")
    contract = relationship("Contract", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    career_history = relationship("CareerHistory", back_populates="employee", cascade="all, delete-orphan")
    disciplinary_actions = relationship("DisciplinaryAction", back_populates="employee", cascade="all, delete-orphan")
    shift = relationship("Shift", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    overtime_records = relationship("Overtime", back_populates="employee", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    documents = relationship("EmployeeDocument", back_populates="employee", cascade="all, delete-orphan")

class Dependent(Base):
    __tablename__ = "dependents"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    relationship = Column(String(50), nullable=False)  # filho(a), cônjuge, etc.
    dob = Column(Date, nullable=False)
    
    # Relationships
    employee = _relationship("Employee", back_populates="dependents")

class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    admission_date = Column(Date, nullable=False)
    role = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    manager_name = Column(String(100), nullable=True)  # Nome do gestor responsável
    base_salary = Column(Float, nullable=False)
    benefits = Column(Text, nullable=True)  # Armazena JSON como texto (VT, VR, Plano de Saúde, etc.)
    job_position_id = Column(String(36), ForeignKey("job_positions.id", ondelete="SET NULL"), nullable=True)
    sector_id = Column(String(36), ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True)
    work_scale_id = Column(String(36), ForeignKey("work_scales.id", ondelete="SET NULL"), nullable=True)
    contract_type = Column(String(50), default="CLT", nullable=False)
    status = Column(String(20), default="Experiência", nullable=False)
    
    # Relationships
    employee = relationship("Employee", back_populates="contract")
    job_position = relationship("JobPosition")
    sector = relationship("Sector")
    work_scale = relationship("WorkScale")

class CareerHistory(Base):
    __tablename__ = "career_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    change_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_by_username = Column(String(50), nullable=False)
    field_name = Column(String(50), nullable=False)  # salary, role, department, status
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    reason = Column(String(255), nullable=True)
    
    # Relationships
    employee = relationship("Employee", back_populates="career_history")

class DisciplinaryAction(Base):
    __tablename__ = "disciplinary_actions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)  # warning (advertência), suspension (suspensão), termination (desligamento)
    action_date = Column(Date, nullable=False)
    details = Column(Text, nullable=False)
    duration_days = Column(Integer, nullable=True)  # para suspensões
    reason = Column(String(255), nullable=False)
    manager_name = Column(String(100), nullable=False)
    
    # Relationships
    employee = relationship("Employee", back_populates="disciplinary_actions")

class Shift(Base):
    __tablename__ = "shifts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    scale_type = Column(String(50), default="5x2", nullable=False)  # 5x2, 6x1, 12x36
    entry_time = Column(String(5), default="09:00", nullable=False)  # HH:MM
    exit_time = Column(String(5), default="18:00", nullable=False)   # HH:MM
    interval_duration_minutes = Column(Integer, default=60, nullable=False)
    bank_of_hours_minutes = Column(Integer, default=0, nullable=False)
    
    # Relationships
    employee = relationship("Employee", back_populates="shift")

class Overtime(Base):
    __tablename__ = "overtime"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    hours_50_minutes = Column(Integer, default=0, nullable=False)
    hours_100_minutes = Column(Integer, default=0, nullable=False)
    hours_night_minutes = Column(Integer, default=0, nullable=False)
    calculated_payment = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, paid
    
    # Relationships
    employee = relationship("Employee", back_populates="overtime_records")

class Leave(Base):
    __tablename__ = "leaves"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(255), nullable=False)  # Médica, Maternidade, Paternidade, Férias, etc.
    doctor_certificate_path = Column(String(255), nullable=True)
    
    # Relationships
    employee = relationship("Employee", back_populates="leaves")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE_EMPLOYEE, UPDATE_SALARY, DELETE_EMPLOYEE, LOGIN, RELATORIO
    table_name = Column(String(50), nullable=True)
    record_id = Column(String(36), nullable=True)
    changed_fields = Column(Text, nullable=True)  # Armazena JSON como texto (ex: {"salary": [2500, 3000]})
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    group = relationship("Group", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    corporate_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=False)
    cnpj = Column(String(20), nullable=False)
    state_inscription = Column(String(30), nullable=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False)
    preferred_payment_method = Column(String(50), nullable=True)
    bank = Column(String(50), nullable=True)
    agency = Column(String(20), nullable=True)
    account = Column(String(30), nullable=True)
    pix_key = Column(String(100), nullable=True)
    payment_terms = Column(String(100), nullable=True)
    delivery_days = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

    # Relationships
    group = relationship("Group", back_populates="suppliers")
    expenses = relationship("FinancialExpense", back_populates="supplier")


class FinancialRevenue(Base):
    __tablename__ = "financial_revenues"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)  # Vendas, Delivery, Eventos, Outros
    date = Column(Date, nullable=False)  # keep as entry/expected date
    expected_date = Column(Date, nullable=True)
    received_date = Column(Date, nullable=True)
    payment_method = Column(String(50), nullable=True)
    status = Column(String(20), default="A Receber", nullable=False)  # A Receber, Recebido, Cancelado
    client = Column(String(255), nullable=True)
    observations = Column(Text, nullable=True)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    change_history = Column(Text, nullable=True)
    reference_month = Column(Integer, nullable=False)
    reference_year = Column(Integer, nullable=False)

    # Relationships
    group = relationship("Group", back_populates="revenues")


class FinancialExpense(Base):
    __tablename__ = "financial_expenses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)  # keep as due date
    due_date = Column(Date, nullable=True)
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(50), nullable=True)
    status = Column(String(20), default="Pendente", nullable=False)  # Pendente, Pago, Cancelado
    observations = Column(Text, nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_period = Column(String(20), nullable=True)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    change_history = Column(Text, nullable=True)
    reference_month = Column(Integer, nullable=False)
    reference_year = Column(Integer, nullable=False)

    # Relationships
    group = relationship("Group", back_populates="expenses")
    supplier = relationship("Supplier", back_populates="expenses")


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

    # Relationships
    group = relationship("Group", back_populates="sectors")


class JobPosition(Base):
    __tablename__ = "job_positions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    sector_id = Column(String(36), ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    base_salary = Column(Float, nullable=False)
    level = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

    # Relationships
    group = relationship("Group", back_populates="job_positions")
    sector = relationship("Sector")


class WorkScale(Base):
    __tablename__ = "work_scales"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    entry_time = Column(String(5), default="09:00", nullable=False)
    exit_time = Column(String(5), default="18:00", nullable=False)
    interval_minutes = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

    # Relationships
    group = relationship("Group", back_populates="work_scales")


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)
    file_path = Column(String(255), nullable=True)
    status = Column(String(20), default="Pendente", nullable=False)  # Pendente, Entregue, Vencido
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

    # Relationships
    employee = relationship("Employee", back_populates="documents")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False, default="Outros")
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String(20), nullable=False, default="unidades")
    min_quantity = Column(Float, nullable=False, default=0.0)
    unit_cost = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)

