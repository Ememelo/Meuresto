from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.all_models import (
    FinancialRevenue,
    FinancialExpense,
    Contract,
    Employee,
    DisciplinaryAction,
    User,
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

# Roles permitted to view and manage financial data
financial_viewers = ["admin", "socio"]
financial_managers = ["admin", "socio"]

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

def calculate_salaries_for_period(db: Session, year: int, month: int) -> float:
    """
    Auto-import salaries from employee contracts active during the given year and month.
    An employee is active if their admission_date <= target_month_end,
    and they are not terminated, OR if terminated, their termination happened during or after the target month.
    """
    total_salary = 0.0
    # Approximate month end
    target_date = date(year, month, 28)  # safe day for any month

    contracts = db.query(Contract).join(Employee).all()
    for contract in contracts:
        emp = contract.employee
        # Check if admitted on or before target month
        if contract.admission_date > target_date:
            continue

        is_active_then = True
        if emp.status == "terminated":
            # Find if there's a termination disciplinary action
            term_action = (
                db.query(DisciplinaryAction)
                .filter(
                    DisciplinaryAction.employee_id == emp.id,
                    DisciplinaryAction.type == "termination",
                )
                .first()
            )
            if term_action:
                # If termination date was before the target month, they weren't active
                term_date = term_action.action_date
                if term_date.year < year or (term_date.year == year and term_date.month < month):
                    is_active_then = False
            else:
                # No termination record found, assume they are not active now
                is_active_then = False

        if is_active_then:
            total_salary += contract.base_salary

    return total_salary

@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    year: int,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_viewers)),
):
    """
    Get financial summary (revenues, expenses, salaries, net results) for a year or a specific month.
    """
    months_to_process = [month] if month is not None else list(range(1, 13))
    
    monthly_breakdown = []
    total_rev = 0.0
    total_exp = 0.0
    total_sal = 0.0

    for m in months_to_process:
        # Sum Revenues
        rev_sum = db.query(FinancialRevenue).filter(
            FinancialRevenue.reference_year == year,
            FinancialRevenue.reference_month == m
        ).all()
        month_rev = sum(r.amount for r in rev_sum)

        # Sum manual Expenses
        exp_sum = db.query(FinancialExpense).filter(
            FinancialExpense.reference_year == year,
            FinancialExpense.reference_month == m
        ).all()
        month_exp = sum(e.amount for e in exp_sum)

        # Sum Salaries (Auto)
        month_sal = calculate_salaries_for_period(db, year, m)

        # Total expenses for summary includes manual expenses + salaries
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

    grand_total_expenses = total_exp + total_sal
    net_result = total_rev - grand_total_expenses
    
    margin = 0.0
    if total_rev > 0:
        margin = (net_result / total_rev) * 100

    return {
        "year": year,
        "month": month,
        "total_revenues": total_rev,
        "total_expenses": total_exp,
        "total_salaries": total_sal,
        "net_result": net_result,
        "margin_percentage": round(margin, 2),
        "monthly_breakdown": monthly_breakdown
    }

# --- REVENUES CRUD ---

@router.get("/revenues", response_model=List[FinancialRevenueResponse])
def list_revenues(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_viewers)),
):
    query = db.query(FinancialRevenue)
    if year:
        query = query.filter(FinancialRevenue.reference_year == year)
    if month:
        query = query.filter(FinancialRevenue.reference_month == month)
    return query.order_by(FinancialRevenue.date.desc()).all()

@router.post("/revenues", response_model=FinancialRevenueResponse, status_code=status.HTTP_201_CREATED)
def create_revenue(
    revenue_in: FinancialRevenueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    ref_month = revenue_in.date.month
    ref_year = revenue_in.date.year

    db_revenue = FinancialRevenue(
        description=revenue_in.description,
        amount=revenue_in.amount,
        category=revenue_in.category,
        date=revenue_in.date,
        created_by=current_user.username,
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
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    db_revenue = db.query(FinancialRevenue).filter(FinancialRevenue.id == revenue_id).first()
    if not db_revenue:
        raise HTTPException(status_code=404, detail="Receita não encontrada")

    old_values = {"description": db_revenue.description, "amount": db_revenue.amount, "date": str(db_revenue.date)}

    db_revenue.description = revenue_in.description
    db_revenue.amount = revenue_in.amount
    db_revenue.category = revenue_in.category
    db_revenue.date = revenue_in.date
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
        {"old": old_values, "new": {"description": db_revenue.description, "amount": db_revenue.amount, "date": str(db_revenue.date)}}
    )
    return db_revenue

@router.delete("/revenues/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revenue(
    revenue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    db_revenue = db.query(FinancialRevenue).filter(FinancialRevenue.id == revenue_id).first()
    if not db_revenue:
        raise HTTPException(status_code=404, detail="Receita não encontrada")

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
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_viewers)),
):
    query = db.query(FinancialExpense)
    if year:
        query = query.filter(FinancialExpense.reference_year == year)
    if month:
        query = query.filter(FinancialExpense.reference_month == month)
    return query.order_by(FinancialExpense.date.desc()).all()

@router.post("/expenses", response_model=FinancialExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_in: FinancialExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    ref_month = expense_in.date.month
    ref_year = expense_in.date.year

    db_expense = FinancialExpense(
        description=expense_in.description,
        amount=expense_in.amount,
        category=expense_in.category,
        date=expense_in.date,
        created_by=current_user.username,
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
    return db_expense

@router.put("/expenses/{expense_id}", response_model=FinancialExpenseResponse)
def update_expense(
    expense_id: str,
    expense_in: FinancialExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    db_expense = db.query(FinancialExpense).filter(FinancialExpense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    old_values = {"description": db_expense.description, "amount": db_expense.amount, "date": str(db_expense.date)}

    db_expense.description = expense_in.description
    db_expense.amount = expense_in.amount
    db_expense.category = expense_in.category
    db_expense.date = expense_in.date
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
        {"old": old_values, "new": {"description": db_expense.description, "amount": db_expense.amount, "date": str(db_expense.date)}}
    )
    return db_expense

@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(financial_managers)),
):
    db_expense = db.query(FinancialExpense).filter(FinancialExpense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

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
