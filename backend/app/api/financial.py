import json
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.all_models import (
    FinancialRevenue,
    FinancialExpense,
    Contract,
    Employee,
    DisciplinaryAction,
    User,
    Supplier,
    Group,
)
from app.schemas.all_schemas import (
    FinancialRevenueCreate,
    FinancialRevenueResponse,
    FinancialExpenseCreate,
    FinancialExpenseResponse,
    FinancialSummaryResponse,
    FinancialSummaryMonth,
)
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/financial", tags=["financial"])

def check_financial_viewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in ["admin", "admin_delegado", "socio"] or current_user.has_financial_access:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para visualizar dados financeiros."
    )

def check_financial_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in ["admin", "admin_delegado", "socio"] or current_user.has_financial_access:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para gerenciar dados financeiros."
    )

def get_month_name(month_num: int) -> str:
    names = {
        1: "Janeiro",
        2: "Fevereiro",
        3: "Março",
        4: "Abril",
        5: "Maio",
        6: "Junho",
        7: "Julho",
        8: "Agosto",
        9: "Setembro",
        10: "Outubro",
        11: "Novembro",
        12: "Dezembro",
    }
    return names.get(month_num, "")

def calculate_salaries_for_period(db: Session, year: int, month: int, current_user: User, group_id: Optional[str] = None) -> float:
    """
    Auto-import salaries from employee contracts active during the given year and month.
    An employee is active if their admission_date <= target_month_end,
    and they are not terminated, OR if terminated, their termination happened during or after the target month.
    """
    total_salary = 0.0
    target_date = date(year, month, 28)  # safe day for any month

    query = db.query(Contract).join(Employee)
    if current_user.role != "admin":
        query = query.filter(Employee.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(Employee.group_id == group_id)
        
    contracts = query.all()
    for contract in contracts:
        emp = contract.employee
        if contract.admission_date > target_date:
            continue

        is_active_then = True
        if emp.status == "terminated":
            term_action = (
                db.query(DisciplinaryAction)
                .filter(
                    DisciplinaryAction.employee_id == emp.id,
                    DisciplinaryAction.type == "termination",
                )
                .first()
            )
            if term_action:
                term_date = term_action.action_date
                if term_date.year < year or (term_date.year == year and term_date.month < month):
                    is_active_then = False
            else:
                is_active_then = False

        if is_active_then:
            total_salary += contract.base_salary
            if contract.benefits:
                try:
                    benefits_data = json.loads(contract.benefits)
                    if isinstance(benefits_data, dict):
                        for b_key, b_val in benefits_data.items():
                            if isinstance(b_val, dict) and b_val.get("active"):
                                cost = b_val.get("cost") or 0.0
                                total_salary += float(cost)
                except Exception:
                    pass

    return total_salary

def generate_next_recurring_expense(db: Session, expense: FinancialExpense, current_user: User):
    """
    Generate next installment of a recurring expense based on recurrence_period:
    semanal, quinzenal, mensal, anual.
    """
    base_date = expense.due_date or expense.date
    if expense.recurrence_period == "semanal":
        next_due = base_date + timedelta(days=7)
    elif expense.recurrence_period == "quinzenal":
        next_due = base_date + timedelta(days=15)
    elif expense.recurrence_period == "mensal":
        try:
            next_due = base_date.replace(month=base_date.month + 1)
        except ValueError:
            if base_date.month == 12:
                next_due = base_date.replace(year=base_date.year + 1, month=1)
            else:
                next_due = base_date + timedelta(days=30)
    elif expense.recurrence_period == "anual":
        try:
            next_due = base_date.replace(year=base_date.year + 1)
        except ValueError:
            next_due = base_date.replace(year=base_date.year + 1, day=28)
    else:
        next_due = base_date + timedelta(days=30)

    next_expense = FinancialExpense(
        group_id=expense.group_id,
        user_id=expense.user_id,
        supplier_id=expense.supplier_id,
        description=expense.description,
        amount=expense.amount,
        category=expense.category,
        date=next_due,
        due_date=next_due,
        payment_date=None,
        payment_method=expense.payment_method,
        status="Pendente",
        observations=expense.observations,
        is_recurring=True,
        recurrence_period=expense.recurrence_period,
        created_by=current_user.username,
        reference_month=next_due.month,
        reference_year=next_due.year,
        change_history=json.dumps([{"timestamp": datetime.utcnow().isoformat(), "user": current_user.username, "action": "recurrence_generation"}])
    )
    db.add(next_expense)
    db.commit()
    db.refresh(next_expense)

@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    year: int,
    month: Optional[int] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_viewer),
):
    """
    Get financial summary (revenues, expenses, salaries, net results) for a year or a specific month.
    """
    months_to_process = [month] if month is not None else list(range(1, 13))
    
    if current_user.role != "admin":
        group_id_to_filter = current_user.group_id
    else:
        group_id_to_filter = group_id
        
    monthly_breakdown = []
    total_rev = 0.0
    total_exp = 0.0
    total_sal = 0.0

    for m in months_to_process:
        # Sum Revenues where status == 'Recebido'
        rev_query = db.query(FinancialRevenue).filter(
            FinancialRevenue.reference_year == year,
            FinancialRevenue.reference_month == m,
            FinancialRevenue.status == "Recebido"
        )
        if group_id_to_filter:
            rev_query = rev_query.filter(FinancialRevenue.group_id == group_id_to_filter)
        month_rev = sum(r.amount for r in rev_query.all())

        # Sum manual Expenses where status == 'Pago'
        exp_query = db.query(FinancialExpense).filter(
            FinancialExpense.reference_year == year,
            FinancialExpense.reference_month == m,
            FinancialExpense.status == "Pago"
        )
        if group_id_to_filter:
            exp_query = exp_query.filter(FinancialExpense.group_id == group_id_to_filter)
        month_exp = sum(e.amount for e in exp_query.all())

        # Sum Salaries (Auto)
        month_sal = calculate_salaries_for_period(db, year, m, current_user, group_id_to_filter)

        combined_exp = month_exp + month_sal
        net = month_rev - combined_exp

        monthly_breakdown.append(
            FinancialSummaryMonth(
                month=m,
                month_name=get_month_name(m),
                revenues=month_rev,
                expenses=month_exp,
                salaries=month_sal,
                net=net
            )
        )

        total_rev += month_rev
        total_exp += month_exp
        total_sal += month_sal

    net_result = total_rev - (total_exp + total_sal)
    
    margin = 0.0
    if total_rev > 0:
        margin = (net_result / total_rev) * 100

    min_rev_year = db.query(func.min(FinancialRevenue.reference_year))
    min_exp_year = db.query(func.min(FinancialExpense.reference_year))
    if group_id_to_filter:
        min_rev_year = min_rev_year.filter(FinancialRevenue.group_id == group_id_to_filter)
        min_exp_year = min_exp_year.filter(FinancialExpense.group_id == group_id_to_filter)
        
    start_year = min(min_rev_year.scalar() or year, min_exp_year.scalar() or year, 2024)
    
    prev_rev = 0.0
    prev_exp = 0.0
    prev_sal = 0.0

    if month is not None:
        prev_rev_sum = db.query(func.sum(FinancialRevenue.amount)).filter(
            FinancialRevenue.status == "Recebido",
            ((FinancialRevenue.reference_year < year) | 
             ((FinancialRevenue.reference_year == year) & (FinancialRevenue.reference_month < month)))
        )
        prev_exp_sum = db.query(func.sum(FinancialExpense.amount)).filter(
            FinancialExpense.status == "Pago",
            ((FinancialExpense.reference_year < year) | 
             ((FinancialExpense.reference_year == year) & (FinancialExpense.reference_month < month)))
        )
        if group_id_to_filter:
            prev_rev_sum = prev_rev_sum.filter(FinancialRevenue.group_id == group_id_to_filter)
            prev_exp_sum = prev_exp_sum.filter(FinancialExpense.group_id == group_id_to_filter)
            
        prev_rev = float(prev_rev_sum.scalar() or 0.0)
        prev_exp = float(prev_exp_sum.scalar() or 0.0)

        for y in range(start_year, year + 1):
            limit_m = month if y == year else 13
            for m_idx in range(1, limit_m):
                prev_sal += calculate_salaries_for_period(db, y, m_idx, current_user, group_id_to_filter)
    else:
        prev_rev_sum = db.query(func.sum(FinancialRevenue.amount)).filter(
            FinancialRevenue.status == "Recebido",
            FinancialRevenue.reference_year < year
        )
        prev_exp_sum = db.query(func.sum(FinancialExpense.amount)).filter(
            FinancialExpense.status == "Pago",
            FinancialExpense.reference_year < year
        )
        if group_id_to_filter:
            prev_rev_sum = prev_rev_sum.filter(FinancialRevenue.group_id == group_id_to_filter)
            prev_exp_sum = prev_exp_sum.filter(FinancialExpense.group_id == group_id_to_filter)
            
        prev_rev = float(prev_rev_sum.scalar() or 0.0)
        prev_exp = float(prev_exp_sum.scalar() or 0.0)

        for y in range(start_year, year):
            for m_idx in range(1, 13):
                prev_sal += calculate_salaries_for_period(db, y, m_idx, current_user, group_id_to_filter)

    prev_balance = prev_rev - (prev_exp + prev_sal)

    all_time_rev_q = db.query(func.sum(FinancialRevenue.amount)).filter(FinancialRevenue.status == "Recebido")
    all_time_exp_q = db.query(func.sum(FinancialExpense.amount)).filter(FinancialExpense.status == "Pago")
    if group_id_to_filter:
        all_time_rev_q = all_time_rev_q.filter(FinancialRevenue.group_id == group_id_to_filter)
        all_time_exp_q = all_time_exp_q.filter(FinancialExpense.group_id == group_id_to_filter)
    
    all_time_rev = float(all_time_rev_q.scalar() or 0.0)
    all_time_exp = float(all_time_exp_q.scalar() or 0.0)
    
    all_time_sal = 0.0
    now = datetime.utcnow()
    for y in range(start_year, now.year + 1):
        limit_m = now.month + 1 if y == now.year else 13
        for m_idx in range(1, limit_m):
            all_time_sal += calculate_salaries_for_period(db, y, m_idx, current_user, group_id_to_filter)
            
    cash_balance = all_time_rev - (all_time_exp + all_time_sal)

    pending_rev_q = db.query(func.sum(FinancialRevenue.amount)).filter(FinancialRevenue.status == "A Receber")
    pending_exp_q = db.query(func.sum(FinancialExpense.amount)).filter(FinancialExpense.status == "Pendente")
    if group_id_to_filter:
        pending_rev_q = pending_rev_q.filter(FinancialRevenue.group_id == group_id_to_filter)
        pending_exp_q = pending_exp_q.filter(FinancialExpense.group_id == group_id_to_filter)
        
    pending_receivables = float(pending_rev_q.scalar() or 0.0)
    pending_payables = float(pending_exp_q.scalar() or 0.0)

    rev_cat_q = db.query(FinancialRevenue).filter(
        FinancialRevenue.reference_year == year,
        FinancialRevenue.status == "Recebido"
    )
    if group_id_to_filter:
        rev_cat_q = rev_cat_q.filter(FinancialRevenue.group_id == group_id_to_filter)
    if month is not None:
        rev_cat_q = rev_cat_q.filter(FinancialRevenue.reference_month == month)
    
    category_revenues = {}
    payment_methods_revenues = {}
    for r in rev_cat_q.all():
        category_revenues[r.category] = category_revenues.get(r.category, 0.0) + r.amount
        if r.payment_method:
            payment_methods_revenues[r.payment_method] = payment_methods_revenues.get(r.payment_method, 0.0) + r.amount

    exp_cat_q = db.query(FinancialExpense).filter(
        FinancialExpense.reference_year == year,
        FinancialExpense.status == "Pago"
    )
    if group_id_to_filter:
        exp_cat_q = exp_cat_q.filter(FinancialExpense.group_id == group_id_to_filter)
    if month is not None:
        exp_cat_q = exp_cat_q.filter(FinancialExpense.reference_month == month)
    
    category_expenses = {}
    payment_methods_expenses = {}
    for e in exp_cat_q.all():
        category_expenses[e.category] = category_expenses.get(e.category, 0.0) + e.amount
        if e.payment_method:
            payment_methods_expenses[e.payment_method] = payment_methods_expenses.get(e.payment_method, 0.0) + e.amount
    
    if total_sal > 0:
        category_expenses["Salários"] = total_sal

    return {
        "year": year,
        "month": month,
        "total_revenues": total_rev,
        "total_expenses": total_exp,
        "total_salaries": total_sal,
        "net_result": net_result,
        "margin_percentage": round(margin, 2),
        "previous_month_balance": prev_balance,
        "cash_balance": cash_balance,
        "pending_receivables": pending_receivables,
        "pending_payables": pending_payables,
        "category_revenues": category_revenues,
        "category_expenses": category_expenses,
        "payment_methods_revenues": payment_methods_revenues,
        "payment_methods_expenses": payment_methods_expenses,
        "monthly_breakdown": monthly_breakdown
    }

# --- REVENUES CRUD ---

@router.get("/revenues", response_model=List[FinancialRevenueResponse])
def list_revenues(
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_viewer),
):
    query = db.query(FinancialRevenue)
    if current_user.role != "admin":
        query = query.filter(FinancialRevenue.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(FinancialRevenue.group_id == group_id)
        
    if year:
        query = query.filter(FinancialRevenue.reference_year == year)
    if month:
        query = query.filter(FinancialRevenue.reference_month == month)
    if status:
        query = query.filter(FinancialRevenue.status == status)
        
    return query.order_by(FinancialRevenue.date.desc()).all()

@router.post("/revenues", response_model=FinancialRevenueResponse, status_code=status.HTTP_201_CREATED)
def create_revenue(
    revenue_in: FinancialRevenueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    ref_month = revenue_in.date.month
    ref_year = revenue_in.date.year

    if current_user.role == "admin":
        group_id_to_set = revenue_in.group_id or getattr(db.query(Group).first(), 'id', None)
    else:
        group_id_to_set = current_user.group_id

    expected_d = revenue_in.expected_date or revenue_in.date
    received_d = revenue_in.received_date
    if revenue_in.status == "Recebido" and not received_d:
        received_d = date.today()

    initial_history = [{"timestamp": datetime.utcnow().isoformat(), "user": current_user.username, "action": "creation"}]

    db_revenue = FinancialRevenue(
        group_id=group_id_to_set,
        user_id=current_user.id,
        description=revenue_in.description,
        amount=revenue_in.amount,
        category=revenue_in.category,
        date=revenue_in.date,
        expected_date=expected_d,
        received_date=received_d,
        payment_method=revenue_in.payment_method,
        status=revenue_in.status,
        client=revenue_in.client,
        observations=revenue_in.observations,
        created_by=current_user.username,
        updated_by=current_user.username,
        change_history=json.dumps(initial_history),
        reference_month=ref_month,
        reference_year=ref_year,
    )
    db.add(db_revenue)
    db.commit()
    db.refresh(db_revenue)
    
    log_action(
        db,
        current_user.id,
        "CREATE_REVENUE",
        "financial_revenues",
        db_revenue.id,
        {"description": db_revenue.description, "amount": db_revenue.amount}
    )
    return db_revenue

@router.put("/revenues/{revenue_id}", response_model=FinancialRevenueResponse)
def update_revenue(
    revenue_id: str,
    revenue_in: FinancialRevenueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    query = db.query(FinancialRevenue).filter(FinancialRevenue.id == revenue_id)
    if current_user.role != "admin":
        query = query.filter(FinancialRevenue.group_id == current_user.group_id)
    db_revenue = query.first()
    if not db_revenue:
        raise HTTPException(status_code=404, detail="Receita não encontrada")

    old_values = {
        "description": db_revenue.description,
        "amount": db_revenue.amount,
        "date": str(db_revenue.date),
        "status": db_revenue.status,
        "payment_method": db_revenue.payment_method,
        "client": db_revenue.client
    }

    received_d = revenue_in.received_date
    if db_revenue.status != "Recebido" and revenue_in.status == "Recebido" and not received_d:
        received_d = date.today()
    elif revenue_in.status != "Recebido":
        received_d = None

    expected_d = revenue_in.expected_date or revenue_in.date

    changes = {}
    for k, v in old_values.items():
        new_val = getattr(revenue_in, k, None)
        if new_val is not None and str(new_val) != str(v):
            changes[k] = [v, str(new_val)]

    history_list = []
    if db_revenue.change_history:
        try:
            history_list = json.loads(db_revenue.change_history)
        except Exception:
            pass
    if changes:
        history_list.append({
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user.username,
            "changes": changes
        })

    db_revenue.description = revenue_in.description
    db_revenue.amount = revenue_in.amount
    db_revenue.category = revenue_in.category
    db_revenue.date = revenue_in.date
    db_revenue.expected_date = expected_d
    db_revenue.received_date = received_d
    db_revenue.payment_method = revenue_in.payment_method
    db_revenue.status = revenue_in.status
    db_revenue.client = revenue_in.client
    db_revenue.observations = revenue_in.observations
    db_revenue.updated_by = current_user.username
    db_revenue.updated_at = datetime.utcnow()
    db_revenue.change_history = json.dumps(history_list)
    db_revenue.reference_month = revenue_in.date.month
    db_revenue.reference_year = revenue_in.date.year

    db.commit()
    db.refresh(db_revenue)

    log_action(
        db,
        current_user.id,
        "UPDATE_REVENUE",
        "financial_revenues",
        db_revenue.id,
        {"old": old_values, "new": {"description": db_revenue.description, "amount": db_revenue.amount, "status": db_revenue.status}}
    )
    return db_revenue

@router.delete("/revenues/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revenue(
    revenue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    query = db.query(FinancialRevenue).filter(FinancialRevenue.id == revenue_id)
    if current_user.role != "admin":
        query = query.filter(FinancialRevenue.group_id == current_user.group_id)
    db_revenue = query.first()
    if not db_revenue:
        raise HTTPException(status_code=404, detail="Receita não encontrada")

    if db_revenue.status in ["Recebido", "Cancelado"]:
        raise HTTPException(
            status_code=400,
            detail="Movimentações recebidas ou canceladas não podem ser excluídas física ou permanentemente. Altere o status para Cancelar se desejar retirá-la do caixa."
        )

    log_action(
        db,
        current_user.id,
        "DELETE_REVENUE",
        "financial_revenues",
        db_revenue.id,
        {"description": db_revenue.description, "amount": db_revenue.amount}
    )

    db.delete(db_revenue)
    db.commit()
    return None

# --- EXPENSES CRUD ---

@router.get("/expenses", response_model=List[FinancialExpenseResponse])
def list_expenses(
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_viewer),
):
    query = db.query(FinancialExpense)
    if current_user.role != "admin":
        query = query.filter(FinancialExpense.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(FinancialExpense.group_id == group_id)
        
    if year:
        query = query.filter(FinancialExpense.reference_year == year)
    if month:
        query = query.filter(FinancialExpense.reference_month == month)
    if status:
        query = query.filter(FinancialExpense.status == status)
        
    return query.order_by(FinancialExpense.date.desc()).all()

@router.post("/expenses", response_model=FinancialExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_in: FinancialExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    ref_month = expense_in.date.month
    ref_year = expense_in.date.year

    if current_user.role == "admin":
        group_id_to_set = expense_in.group_id or getattr(db.query(Group).first(), 'id', None)
    else:
        group_id_to_set = current_user.group_id

    due_d = expense_in.due_date or expense_in.date
    payment_d = expense_in.payment_date
    if expense_in.status == "Pago" and not payment_d:
        payment_d = date.today()

    initial_history = [{"timestamp": datetime.utcnow().isoformat(), "user": current_user.username, "action": "creation"}]

    db_expense = FinancialExpense(
        group_id=group_id_to_set,
        user_id=current_user.id,
        supplier_id=expense_in.supplier_id,
        description=expense_in.description,
        amount=expense_in.amount,
        category=expense_in.category,
        date=expense_in.date,
        due_date=due_d,
        payment_date=payment_d,
        payment_method=expense_in.payment_method,
        status=expense_in.status,
        observations=expense_in.observations,
        is_recurring=expense_in.is_recurring,
        recurrence_period=expense_in.recurrence_period,
        created_by=current_user.username,
        updated_by=current_user.username,
        change_history=json.dumps(initial_history),
        reference_month=ref_month,
        reference_year=ref_year,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    log_action(
        db,
        current_user.id,
        "CREATE_EXPENSE",
        "financial_expenses",
        db_expense.id,
        {"description": db_expense.description, "amount": db_expense.amount}
    )

    if db_expense.status == "Pago" and db_expense.is_recurring:
        generate_next_recurring_expense(db, db_expense, current_user)

    return db_expense

@router.put("/expenses/{expense_id}", response_model=FinancialExpenseResponse)
def update_expense(
    expense_id: str,
    expense_in: FinancialExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    query = db.query(FinancialExpense).filter(FinancialExpense.id == expense_id)
    if current_user.role != "admin":
        query = query.filter(FinancialExpense.group_id == current_user.group_id)
    db_expense = query.first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    old_values = {
        "description": db_expense.description,
        "amount": db_expense.amount,
        "date": str(db_expense.date),
        "status": db_expense.status,
        "payment_method": db_expense.payment_method,
        "supplier_id": db_expense.supplier_id,
        "is_recurring": db_expense.is_recurring
    }

    old_status = db_expense.status

    payment_d = expense_in.payment_date
    if old_status != "Pago" and expense_in.status == "Pago" and not payment_d:
        payment_d = date.today()
    elif expense_in.status != "Pago":
        payment_d = None

    due_d = expense_in.due_date or expense_in.date

    changes = {}
    for k, v in old_values.items():
        new_val = getattr(expense_in, k, None)
        if new_val is not None and str(new_val) != str(v):
            changes[k] = [v, str(new_val)]

    history_list = []
    if db_expense.change_history:
        try:
            history_list = json.loads(db_expense.change_history)
        except Exception:
            pass
    if changes:
        history_list.append({
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user.username,
            "changes": changes
        })

    db_expense.description = expense_in.description
    db_expense.amount = expense_in.amount
    db_expense.category = expense_in.category
    db_expense.date = expense_in.date
    db_expense.due_date = due_d
    db_expense.payment_date = payment_d
    db_expense.payment_method = expense_in.payment_method
    db_expense.status = expense_in.status
    db_expense.supplier_id = expense_in.supplier_id
    db_expense.observations = expense_in.observations
    db_expense.is_recurring = expense_in.is_recurring
    db_expense.recurrence_period = expense_in.recurrence_period
    db_expense.updated_by = current_user.username
    db_expense.updated_at = datetime.utcnow()
    db_expense.change_history = json.dumps(history_list)
    db_expense.reference_month = expense_in.date.month
    db_expense.reference_year = expense_in.date.year

    db.commit()
    db.refresh(db_expense)

    log_action(
        db,
        current_user.id,
        "UPDATE_EXPENSE",
        "financial_expenses",
        db_expense.id,
        {"old": old_values, "new": {"description": db_expense.description, "amount": db_expense.amount, "status": db_expense.status}}
    )

    if old_status != "Pago" and db_expense.status == "Pago" and db_expense.is_recurring:
        generate_next_recurring_expense(db, db_expense, current_user)

    return db_expense

@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_financial_manager),
):
    query = db.query(FinancialExpense).filter(FinancialExpense.id == expense_id)
    if current_user.role != "admin":
        query = query.filter(FinancialExpense.group_id == current_user.group_id)
    db_expense = query.first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    if db_expense.status in ["Pago", "Cancelado"]:
        raise HTTPException(
            status_code=400,
            detail="Movimentações pagas ou canceladas não podem ser excluídas física ou permanentemente. Altere o status para Cancelar se desejar retirá-la do fluxo."
        )

    log_action(
        db,
        current_user.id,
        "DELETE_EXPENSE",
        "financial_expenses",
        db_expense.id,
        {"description": db_expense.description, "amount": db_expense.amount}
    )

    db.delete(db_expense)
    db.commit()
    return None
