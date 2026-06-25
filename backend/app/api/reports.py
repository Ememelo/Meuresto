from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Employee, User, FinancialRevenue, FinancialExpense, Supplier
from app.api.auth import get_current_user, RoleChecker
from app.services.pdf_generator import generate_employee_ficha_pdf, generate_financial_pdf
from app.services.excel_exporter import export_consolidated_data_excel, export_financial_excel
from app.services.audit_service import log_action

router = APIRouter(prefix="/reports", tags=["reports"])

from app.api.employees import check_employee_group

def check_reports_viewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in ["admin", "admin_delegado", "rh", "socio"]:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para visualizar relatórios."
    )

@router.get("/employee/{employee_id}/pdf")
def get_employee_pdf(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads the Ficha do Colaborador PDF. Accessible to all logged in users.
    """
    emp = check_employee_group(db, employee_id, current_user)
        
    pdf_buffer = generate_employee_ficha_pdf(emp)
    
    log_action(db, current_user.id, "EXPORT_PDF", "employees", employee_id)
    
    filename = f"ficha_{emp.registration_number}_{emp.name.replace(' ', '_')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/excel")
def get_consolidated_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reports_viewer)
):
    """
    Downloads the consolidated spreadsheet report. Restricted to Admin, Admin Delegado, RH, and Sócio.
    """
    excel_buffer = export_consolidated_data_excel(db, current_user)
    
    log_action(db, current_user.id, "EXPORT_EXCEL")
    
    filename = "relatorio_consolidado_meuresto.xlsx"
    
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/financial/excel")
def get_financial_excel_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    supplier_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reports_viewer)
):
    """
    Export financial data based on filters to an Excel sheet.
    """
    # Enforce tenant scoping
    if current_user.role != "admin":
        group_id_to_use = current_user.group_id
    else:
        group_id_to_use = group_id

    excel_buffer = export_financial_excel(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
        category=category,
        supplier_id=supplier_id,
        payment_method=payment_method,
        status=status
    )
    
    log_action(db, current_user.id, "EXPORT_FINANCIAL_EXCEL")
    
    filename = "relatorio_financeiro_meuresto.xlsx"
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/financial/pdf")
def get_financial_pdf_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    supplier_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reports_viewer)
):
    """
    Export financial data based on filters to a PDF document.
    """
    # Query revenues and expenses matching filters for the PDF
    rev_q = db.query(FinancialRevenue)
    exp_q = db.query(FinancialExpense)
    
    if current_user.role != "admin":
        rev_q = rev_q.filter(FinancialRevenue.group_id == current_user.group_id)
        exp_q = exp_q.filter(FinancialExpense.group_id == current_user.group_id)
    elif group_id:
        rev_q = rev_q.filter(FinancialRevenue.group_id == group_id)
        exp_q = exp_q.filter(FinancialExpense.group_id == group_id)
        
    if start_date:
        rev_q = rev_q.filter(FinancialRevenue.date >= start_date)
        exp_q = exp_q.filter(FinancialExpense.date >= start_date)
    if end_date:
        rev_q = rev_q.filter(FinancialRevenue.date <= end_date)
        exp_q = exp_q.filter(FinancialExpense.date <= end_date)
    if category:
        rev_q = rev_q.filter(FinancialRevenue.category == category)
        exp_q = exp_q.filter(FinancialExpense.category == category)
    if payment_method:
        rev_q = rev_q.filter(FinancialRevenue.payment_method == payment_method)
        exp_q = exp_q.filter(FinancialExpense.payment_method == payment_method)
    if status:
        rev_q = rev_q.filter(FinancialRevenue.status == status)
        exp_q = exp_q.filter(FinancialExpense.status == status)
    if supplier_id:
        exp_q = exp_q.filter(FinancialExpense.supplier_id == supplier_id)
        
    revenues = rev_q.all()
    expenses = exp_q.all()
    
    flow_items = []
    for r in revenues:
        flow_items.append((r.date, "RECEITA", r.description, r.client or "N/A", r.category, r.amount, r.payment_method or "N/A", r.status))
    for e in expenses:
        supp_name = e.supplier.trade_name if e.supplier else "N/A"
        flow_items.append((e.date, "DESPESA", e.description, supp_name, e.category, e.amount, e.payment_method or "N/A", e.status))
        
    flow_items.sort(key=lambda x: x[0], reverse=True)
    
    filters_desc = []
    if start_date: filters_desc.append(f"Início: {start_date}")
    if end_date: filters_desc.append(f"Fim: {end_date}")
    if category: filters_desc.append(f"Cat: {category}")
    if status: filters_desc.append(f"Status: {status}")
    if payment_method: filters_desc.append(f"Forma: {payment_method}")
    filters_summary = " | ".join(filters_desc) if filters_desc else "Todos Lançamentos"
    
    pdf_buffer = generate_financial_pdf(flow_items, filters_summary)
    
    log_action(db, current_user.id, "EXPORT_FINANCIAL_PDF")
    
    filename = "relatorio_financeiro_meuresto.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

