import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.db.session import Base

# Alias to avoid naming collisions in classes with a 'relationship' column
_relationship = relationship


class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="consulta", nullable=False)  # admin, rh, socio, gestor, consulta
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
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
    
    # Relationships
    dependents = relationship("Dependent", back_populates="employee", cascade="all, delete-orphan")
    contract = relationship("Contract", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    career_history = relationship("CareerHistory", back_populates="employee", cascade="all, delete-orphan")
    disciplinary_actions = relationship("DisciplinaryAction", back_populates="employee", cascade="all, delete-orphan")
    shift = relationship("Shift", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    overtime_records = relationship("Overtime", back_populates="employee", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")

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
    
    # Relationships
    employee = relationship("Employee", back_populates="contract")

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
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE_EMPLOYEE, UPDATE_SALARY, DELETE_EMPLOYEE, LOGIN, RELATORIO
    table_name = Column(String(50), nullable=True)
    record_id = Column(String(36), nullable=True)
    changed_fields = Column(Text, nullable=True)  # Armazena JSON como texto (ex: {"salary": [2500, 3000]})
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")


class FinancialRevenue(Base):
    __tablename__ = "financial_revenues"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)  # Vendas, Delivery, Eventos, Outros
    date = Column(Date, nullable=False)
    created_by = Column(String(50), nullable=True)
    reference_month = Column(Integer, nullable=False)
    reference_year = Column(Integer, nullable=False)


class FinancialExpense(Base):
    __tablename__ = "financial_expenses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)  # Compras/Insumos, Salários, Aluguel, Energia/Água, Equipamentos, Marketing, Outros
    date = Column(Date, nullable=False)
    created_by = Column(String(50), nullable=True)
    reference_month = Column(Integer, nullable=False)
    reference_year = Column(Integer, nullable=False)
