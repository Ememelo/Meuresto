import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Group, User
from app.schemas.all_schemas import GroupCreate, GroupResponse
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/groups", tags=["groups"])

# 1. Rota Pública para listar grupos ativos (usado no Sign Up)
@router.get("/public")
def list_active_groups_public(db: Session = Depends(get_db)):
    groups = db.query(Group).filter(Group.is_active == True).all()
    return [{"id": g.id, "name": g.name} for g in groups]

# 2. Listar todos os grupos (Apenas Admin Master)
@router.get("", response_model=List[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    return db.query(Group).all()

# 3. Criar Novo Grupo (Apenas Admin Master)
@router.post("", response_model=GroupResponse)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    # Check duplicate name
    existing = db.query(Group).filter(Group.name == group_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma empresa ou grupo cadastrado com este nome."
        )
    
    new_group = Group(
        id=str(uuid.uuid4()),
        name=group_in.name,
        is_active=group_in.is_active
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    log_action(db, current_user.id, "CREATE_GROUP", "groups", new_group.id, {"name": new_group.name})
    return new_group

# 4. Atualizar Grupo (Apenas Admin Master)
@router.put("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: str,
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
        
    # Check duplicate name (if name changed)
    if group.name != group_in.name:
        existing = db.query(Group).filter(Group.name == group_in.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe uma empresa ou grupo cadastrado com este nome."
            )
            
    group.name = group_in.name
    group.is_active = group_in.is_active
    db.commit()
    db.refresh(group)
    
    log_action(db, current_user.id, "UPDATE_GROUP", "groups", group.id, {"name": group.name, "is_active": group.is_active})
    return group

# 5. Excluir Grupo (Apenas Admin Master)
@router.delete("/{group_id}")
def delete_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
        
    # Check if there are users or employees in this group
    has_users = db.query(User).filter(User.group_id == group_id).first()
    if has_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir um grupo que possui usuários vinculados. Transfira ou exclua os usuários primeiro."
        )
        
    group_name = group.name
    db.delete(group)
    db.commit()
    
    log_action(db, current_user.id, "DELETE_GROUP", "groups", group_id, {"name": group_name})
    return {"message": f"Grupo {group_name} excluído com sucesso."}
