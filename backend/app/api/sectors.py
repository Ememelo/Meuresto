import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.all_models import Sector, User, Group
from app.schemas.all_schemas import SectorCreate, SectorResponse
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/sectors", tags=["sectors"])

# Only HR, Admin Master, or Admin Delegado can view/manage sectors
check_hr_manager = RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access")

@router.get("", response_model=List[SectorResponse])
def list_sectors(
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_group_id = current_user.group_id if current_user.role != "admin" else group_id
    if target_group_id:
        try:
            from app.services.restaurant_defaults import prepopulate_restaurant_defaults
            prepopulate_restaurant_defaults(db, target_group_id)
        except Exception:
            pass

    query = db.query(Sector)
    if current_user.role != "admin":
        query = query.filter(Sector.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(Sector.group_id == group_id)
        
    return query.order_by(Sector.name.asc()).all()

@router.post("", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
def create_sector(
    sector_in: SectorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_hr_manager)
):
    if current_user.role == "admin":
        first_group = db.query(Group).first()
        group_id_to_set = first_group.id if first_group else None
    else:
        group_id_to_set = current_user.group_id

    # Check duplicate name in the same tenant group
    existing = db.query(Sector).filter(
        Sector.name == sector_in.name,
        Sector.group_id == group_id_to_set
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Já existe um setor cadastrado com este nome nesta empresa."
        )

    db_sector = Sector(
        group_id=group_id_to_set,
        name=sector_in.name,
        description=sector_in.description,
        is_active=sector_in.is_active,
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(db_sector)
    db.commit()
    db.refresh(db_sector)

    log_action(db, current_user.id, "CREATE_SECTOR", "sectors", db_sector.id, {"name": db_sector.name})
    return db_sector

@router.put("/{sector_id}", response_model=SectorResponse)
def update_sector(
    sector_id: str,
    sector_in: SectorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_hr_manager)
):
    db_sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not db_sector:
        raise HTTPException(status_code=404, detail="Setor não encontrado.")
    
    if current_user.role != "admin" and db_sector.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Você não tem permissão para editar dados desta empresa.")

    db_sector.name = sector_in.name
    db_sector.description = sector_in.description
    db_sector.is_active = sector_in.is_active
    db_sector.updated_at = datetime.utcnow()
    db_sector.updated_by = current_user.username
    
    db.commit()
    db.refresh(db_sector)

    log_action(db, current_user.id, "UPDATE_SECTOR", "sectors", db_sector.id, {"name": db_sector.name})
    return db_sector

@router.delete("/{sector_id}", status_code=status.HTTP_200_OK)
def delete_sector(
    sector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_hr_manager)
):
    db_sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not db_sector:
        raise HTTPException(status_code=404, detail="Setor não encontrado.")
    
    if current_user.role != "admin" and db_sector.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Você não tem permissão para deletar dados desta empresa.")

    db.delete(db_sector)
    db.commit()

    log_action(db, current_user.id, "DELETE_SECTOR", "sectors", sector_id)
    return {"message": "Setor excluído com sucesso."}
