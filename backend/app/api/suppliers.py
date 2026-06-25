import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Supplier, User, Group
from app.schemas.all_schemas import SupplierCreate, SupplierResponse
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

def check_supplier_viewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in ["admin", "admin_delegado", "socio"] or current_user.has_financial_access:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para visualizar fornecedores."
    )

def check_supplier_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in ["admin", "admin_delegado", "socio"] or current_user.has_financial_access:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para gerenciar fornecedores."
    )

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_supplier_viewer)
):
    query = db.query(Supplier)
    if current_user.role != "admin":
        query = query.filter(Supplier.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(Supplier.group_id == group_id)
        
    return query.order_by(Supplier.corporate_name.asc()).all()

@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_supplier_manager)
):
    if current_user.role == "admin":
        first_group = db.query(Group).first()
        group_id_to_set = first_group.id if first_group else None
    else:
        group_id_to_set = current_user.group_id

    # Check duplicate CNPJ in the same tenant group
    existing = db.query(Supplier).filter(
        Supplier.cnpj == supplier_in.cnpj,
        Supplier.group_id == group_id_to_set
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Já existe um fornecedor cadastrado com este CNPJ nesta empresa."
        )

    db_supplier = Supplier(
        group_id=group_id_to_set,
        corporate_name=supplier_in.corporate_name,
        trade_name=supplier_in.trade_name,
        cnpj=supplier_in.cnpj,
        state_inscription=supplier_in.state_inscription,
        contact_person=supplier_in.contact_person,
        phone=supplier_in.phone,
        whatsapp=supplier_in.whatsapp,
        email=supplier_in.email,
        address=supplier_in.address,
        category=supplier_in.category,
        preferred_payment_method=supplier_in.preferred_payment_method,
        bank=supplier_in.bank,
        agency=supplier_in.agency,
        account=supplier_in.account,
        pix_key=supplier_in.pix_key,
        payment_terms=supplier_in.payment_terms,
        delivery_days=supplier_in.delivery_days,
        notes=supplier_in.notes,
        is_active=supplier_in.is_active,
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)

    log_action(
        db,
        current_user.id,
        "CREATE_SUPPLIER",
        "suppliers",
        db_supplier.id,
        {"trade_name": db_supplier.trade_name, "cnpj": db_supplier.cnpj}
    )
    return db_supplier

@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_supplier_viewer)
):
    query = db.query(Supplier).filter(Supplier.id == supplier_id)
    if current_user.role != "admin":
        query = query.filter(Supplier.group_id == current_user.group_id)
        
    supplier = query.first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_supplier_manager)
):
    query = db.query(Supplier).filter(Supplier.id == supplier_id)
    if current_user.role != "admin":
        query = query.filter(Supplier.group_id == current_user.group_id)
        
    db_supplier = query.first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    # Check CNPJ duplicate (if changed)
    if db_supplier.cnpj != supplier_in.cnpj:
        existing = db.query(Supplier).filter(
            Supplier.cnpj == supplier_in.cnpj,
            Supplier.group_id == db_supplier.group_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Já existe um fornecedor cadastrado com este CNPJ nesta empresa."
            )

    old_values = {"trade_name": db_supplier.trade_name, "is_active": db_supplier.is_active}

    db_supplier.corporate_name = supplier_in.corporate_name
    db_supplier.trade_name = supplier_in.trade_name
    db_supplier.cnpj = supplier_in.cnpj
    db_supplier.state_inscription = supplier_in.state_inscription
    db_supplier.contact_person = supplier_in.contact_person
    db_supplier.phone = supplier_in.phone
    db_supplier.whatsapp = supplier_in.whatsapp
    db_supplier.email = supplier_in.email
    db_supplier.address = supplier_in.address
    db_supplier.category = supplier_in.category
    db_supplier.preferred_payment_method = supplier_in.preferred_payment_method
    db_supplier.bank = supplier_in.bank
    db_supplier.agency = supplier_in.agency
    db_supplier.account = supplier_in.account
    db_supplier.pix_key = supplier_in.pix_key
    db_supplier.payment_terms = supplier_in.payment_terms
    db_supplier.delivery_days = supplier_in.delivery_days
    db_supplier.notes = supplier_in.notes
    db_supplier.is_active = supplier_in.is_active
    db_supplier.updated_by = current_user.username
    db_supplier.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_supplier)

    log_action(
        db,
        current_user.id,
        "UPDATE_SUPPLIER",
        "suppliers",
        db_supplier.id,
        {"old": old_values, "new": {"trade_name": db_supplier.trade_name, "is_active": db_supplier.is_active}}
    )
    return db_supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_supplier_manager)
):
    query = db.query(Supplier).filter(Supplier.id == supplier_id)
    if current_user.role != "admin":
        query = query.filter(Supplier.group_id == current_user.group_id)
        
    db_supplier = query.first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    log_action(
        db,
        current_user.id,
        "DELETE_SUPPLIER",
        "suppliers",
        db_supplier.id,
        {"trade_name": db_supplier.trade_name}
    )

    db.delete(db_supplier)
    db.commit()
    return None
