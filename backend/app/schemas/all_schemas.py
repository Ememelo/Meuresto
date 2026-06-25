from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ----------------- Group Schemas -----------------
class GroupBase(BaseModel):
    name: str
    is_active: bool = True

class GroupCreate(GroupBase):
    pass

class GroupResponse(GroupBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True

# ----------------- User Schemas -----------------
class UserBase(BaseModel):
    username: str
    email: str
    role: str
    group_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    password_reset_requested: bool = False
    has_financial_access: bool = False

    class Config:
        orm_mode = True

class UserRoleUpdateRequest(BaseModel):
    role: str

class UserGroupUpdateRequest(BaseModel):
    group_id: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

class AdminPasswordResetRequest(BaseModel):
    new_password: str

class ForgotPasswordRequest(BaseModel):
    username: str
    email: str

# ----------------- Dependent Schemas -----------------
class DependentBase(BaseModel):
    name: str
    relationship: str
    dob: date

class DependentCreate(DependentBase):
    pass

class DependentResponse(DependentBase):
    id: str
    employee_id: str

    class Config:
        orm_mode = True

# ----------------- Contract Schemas -----------------
class ContractBase(BaseModel):
    admission_date: date
    role: str
    department: str
    manager_name: Optional[str] = None
    base_salary: float
    benefits: Optional[str] = None  # JSON string

class ContractCreate(ContractBase):
    pass

class ContractResponse(ContractBase):
    id: str
    employee_id: str

    class Config:
        orm_mode = True

# ----------------- Shift Schemas -----------------
class ShiftBase(BaseModel):
    scale_type: str = "5x2"
    entry_time: str = "09:00"
    exit_time: str = "18:00"
    interval_duration_minutes: int = 60
    bank_of_hours_minutes: int = 0

class ShiftCreate(ShiftBase):
    pass

class ShiftResponse(ShiftBase):
    id: str
    employee_id: str

    class Config:
        orm_mode = True

# ----------------- Employee Schemas -----------------
class EmployeeBase(BaseModel):
    group_id: Optional[str] = None
    registration_number: Optional[str] = None
    name: str
    cpf: str
    rg: str
    dob: date
    civil_status: str
    nationality: str
    email: str
    phone: str
    address_cep: str
    address_street: str
    address_number: str
    address_complement: Optional[str] = None
    address_neighborhood: str
    address_city: str
    address_state: str
    mother_name: str
    father_name: Optional[str] = None
    photo_path: Optional[str] = None
    has_disability: bool = False
    disability_details: Optional[str] = None
    education: str
    status: str = "active"
    ctps: Optional[str] = None
    pis: Optional[str] = None
    reservista: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    contract: ContractCreate
    shift: Optional[ShiftCreate] = None
    dependents: Optional[List[DependentCreate]] = []

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    rg: Optional[str] = None
    cpf: Optional[str] = None
    dob: Optional[date] = None
    civil_status: Optional[str] = None
    nationality: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_cep: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    has_disability: Optional[bool] = None
    disability_details: Optional[str] = None
    education: Optional[str] = None
    status: Optional[str] = None
    ctps: Optional[str] = None
    pis: Optional[str] = None
    reservista: Optional[str] = None
    
    # Optional nested contract update
    role: Optional[str] = None
    department: Optional[str] = None
    manager_name: Optional[str] = None
    base_salary: Optional[float] = None
    benefits: Optional[str] = None
    reason_for_change: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: str
    contract: Optional[ContractResponse] = None
    shift: Optional[ShiftResponse] = None
    dependents: List[DependentResponse] = []

    class Config:
        orm_mode = True

class EmployeeListResponse(BaseModel):
    id: str
    registration_number: str
    name: str
    cpf: str
    status: str
    role: Optional[str] = None
    department: Optional[str] = None
    admission_date: Optional[date] = None

    class Config:
        orm_mode = True

# ----------------- CareerHistory Schemas -----------------
class CareerHistoryResponse(BaseModel):
    id: str
    employee_id: str
    change_date: datetime
    changed_by_username: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None

    class Config:
        orm_mode = True

# ----------------- DisciplinaryAction Schemas -----------------
class DisciplinaryActionBase(BaseModel):
    type: str  # warning, suspension, termination
    action_date: date
    details: str
    duration_days: Optional[int] = None
    reason: str
    manager_name: str

class DisciplinaryActionCreate(DisciplinaryActionBase):
    employee_id: str

class DisciplinaryActionResponse(DisciplinaryActionBase):
    id: str
    employee_id: str

    class Config:
        orm_mode = True

# ----------------- Overtime Schemas -----------------
class OvertimeBase(BaseModel):
    date: date
    hours_50_minutes: int = 0
    hours_100_minutes: int = 0
    hours_night_minutes: int = 0
    status: str = "pending"

class OvertimeCreate(OvertimeBase):
    employee_id: str

class OvertimeUpdate(BaseModel):
    status: str

class OvertimeResponse(OvertimeBase):
    id: str
    employee_id: str
    calculated_payment: float

    class Config:
        orm_mode = True

# ----------------- Leave Schemas -----------------
class LeaveBase(BaseModel):
    start_date: date
    end_date: date
    reason: str

class LeaveCreate(LeaveBase):
    employee_id: str

class LeaveResponse(LeaveBase):
    id: str
    employee_id: str
    doctor_certificate_path: Optional[str] = None

    class Config:
        orm_mode = True

# ----------------- AuditLog Schemas -----------------
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None  # resolved from user relation
    action: str
    table_name: Optional[str] = None
    record_id: Optional[str] = None
    changed_fields: Optional[str] = None
    timestamp: datetime

    class Config:
        orm_mode = True


# ----------------- Supplier Schemas -----------------
class SupplierBase(BaseModel):
    corporate_name: str
    trade_name: str
    cnpj: str
    state_inscription: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    category: str
    preferred_payment_method: Optional[str] = None
    bank: Optional[str] = None
    agency: Optional[str] = None
    account: Optional[str] = None
    pix_key: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery_days: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: str
    group_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

    class Config:
        orm_mode = True


# ----------------- Financial Schemas -----------------
class FinancialRevenueBase(BaseModel):
    description: str
    amount: float
    category: str
    date: date
    expected_date: Optional[date] = None
    received_date: Optional[date] = None
    payment_method: Optional[str] = None
    status: str = "A Receber"
    client: Optional[str] = None
    observations: Optional[str] = None
    group_id: Optional[str] = None

class FinancialRevenueCreate(FinancialRevenueBase):
    pass

class FinancialRevenueResponse(FinancialRevenueBase):
    id: str
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    change_history: Optional[str] = None
    reference_month: int
    reference_year: int

    class Config:
        orm_mode = True

class FinancialExpenseBase(BaseModel):
    description: str
    amount: float
    category: str
    date: date
    supplier_id: Optional[str] = None
    due_date: Optional[date] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    status: str = "Pendente"
    observations: Optional[str] = None
    is_recurring: bool = False
    recurrence_period: Optional[str] = None
    group_id: Optional[str] = None

class FinancialExpenseCreate(FinancialExpenseBase):
    pass

class FinancialExpenseResponse(FinancialExpenseBase):
    id: str
    supplier: Optional[SupplierResponse] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    change_history: Optional[str] = None
    reference_month: int
    reference_year: int

    class Config:
        orm_mode = True

class FinancialSummaryMonth(BaseModel):
    month: int
    month_name: str
    revenues: float
    expenses: float
    salaries: float
    net: float

class FinancialSummaryResponse(BaseModel):
    year: int
    month: Optional[int] = None
    total_revenues: float
    total_expenses: float
    total_salaries: float
    net_result: float
    margin_percentage: float
    previous_month_balance: Optional[float] = 0.0
    cash_balance: Optional[float] = 0.0
    pending_receivables: Optional[float] = 0.0
    pending_payables: Optional[float] = 0.0
    category_revenues: Optional[Dict[str, float]] = None
    category_expenses: Optional[Dict[str, float]] = None
    payment_methods_revenues: Optional[Dict[str, float]] = None
    payment_methods_expenses: Optional[Dict[str, float]] = None
    monthly_breakdown: List[FinancialSummaryMonth]

