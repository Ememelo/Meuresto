from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Employee, User
from app.api.auth import get_current_user, RoleChecker
from app.services.pdf_generator import generate_employee_ficha_pdf
from app.services.excel_exporter import export_consolidated_data_excel
from app.services.audit_service import log_action

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/employee/{employee_id}/pdf")
def get_employee_pdf(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads the Ficha do Colaborador PDF. Accessible to all logged in users.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
        
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
    current_user: User = Depends(RoleChecker(["admin", "rh", "socio"]))
):
    """
    Downloads the consolidated spreadsheet report. Restricted to Admin, RH, and Sócio.
    """
    excel_buffer = export_consolidated_data_excel(db)
    
    log_action(db, current_user.id, "EXPORT_EXCEL")
    
    filename = "relatorio_consolidado_meuresto.xlsx"
    
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
