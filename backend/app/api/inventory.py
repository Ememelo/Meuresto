import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.all_models import InventoryItem, User, Group
from app.schemas.all_schemas import InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse, InventoryItemAdjust
from app.api.auth import get_current_user, RoleChecker
from app.services.audit_service import log_action

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Only Admin Master, Admin Delegado, and RH can manage inventory edits (create, edit, delete, adjust)
check_inventory_manager = RoleChecker(["rh", "admin", "admin_delegado"], required_permission="has_hr_access")

@router.get("", response_model=List[InventoryItemResponse])
def list_inventory_items(
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all inventory items. Master admin sees all or filters by group_id.
    Other roles see only their company's inventory.
    """
    query = db.query(InventoryItem)
    if current_user.role != "admin":
        query = query.filter(InventoryItem.group_id == current_user.group_id)
    elif group_id:
        query = query.filter(InventoryItem.group_id == group_id)
        
    return query.order_by(InventoryItem.name.asc()).all()


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(
    item_in: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_manager)
):
    """
    Create a new inventory item.
    """
    if current_user.role == "admin":
        first_group = db.query(Group).first()
        group_id_to_set = first_group.id if first_group else None
    else:
        group_id_to_set = current_user.group_id

    if not group_id_to_set:
        raise HTTPException(status_code=400, detail="Grupo ou empresa não vinculada para cadastro de item.")

    # Check duplicate name in the same tenant group
    existing = db.query(InventoryItem).filter(
        InventoryItem.name == item_in.name,
        InventoryItem.group_id == group_id_to_set
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Já existe um item cadastrado com este nome no estoque."
        )

    db_item = InventoryItem(
        group_id=group_id_to_set,
        name=item_in.name,
        category=item_in.category,
        quantity=item_in.quantity,
        unit=item_in.unit,
        min_quantity=item_in.min_quantity,
        unit_cost=item_in.unit_cost,
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    log_action(
        db, 
        current_user.id, 
        "CREATE_INVENTORY_ITEM", 
        "inventory_items", 
        db_item.id, 
        {"name": db_item.name, "category": db_item.category}
    )
    return db_item


@router.put("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    item_id: str,
    item_in: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_manager)
):
    """
    Update details of an inventory item.
    """
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado.")

    # Check group isolation for non-admin
    if current_user.role != "admin" and db_item.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Acesso não autorizado aos dados desta empresa.")

    # Check name duplicate if name changed
    if item_in.name is not None and item_in.name != db_item.name:
        existing = db.query(InventoryItem).filter(
            InventoryItem.name == item_in.name,
            InventoryItem.group_id == db_item.group_id,
            InventoryItem.id != item_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Já existe outro item cadastrado com este nome.")

    for field, val in item_in.dict(exclude_unset=True).items():
        setattr(db_item, field, val)

    db_item.updated_at = datetime.utcnow()
    db_item.updated_by = current_user.username

    db.commit()
    db.refresh(db_item)

    log_action(db, current_user.id, "UPDATE_INVENTORY_ITEM", "inventory_items", item_id, {"name": db_item.name})
    return db_item


@router.delete("/{item_id}")
def delete_inventory_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_manager)
):
    """
    Delete an inventory item.
    """
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado.")

    # Check group isolation for non-admin
    if current_user.role != "admin" and db_item.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Acesso não autorizado aos dados desta empresa.")

    name = db_item.name
    db.delete(db_item)
    db.commit()

    log_action(db, current_user.id, "DELETE_INVENTORY_ITEM", "inventory_items", item_id, {"name": name})
    return {"message": f"Item '{name}' excluído com sucesso."}


@router.post("/{item_id}/adjust", response_model=InventoryItemResponse)
def adjust_inventory_item(
    item_id: str,
    adjustment: InventoryItemAdjust,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_manager)
):
    """
    Adjust quantity of an inventory item (register entry or exit/loss).
    """
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado.")

    # Check group isolation for non-admin
    if current_user.role != "admin" and db_item.group_id != current_user.group_id:
        raise HTTPException(status_code=403, detail="Acesso não autorizado aos dados desta empresa.")

    old_qty = db_item.quantity
    new_qty = old_qty + adjustment.quantity_change
    if new_qty < 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Operação cancelada. A saída de {abs(adjustment.quantity_change)} {db_item.unit} excede o saldo atual em estoque de {old_qty} {db_item.unit}."
        )

    db_item.quantity = new_qty
    db_item.updated_at = datetime.utcnow()
    db_item.updated_by = current_user.username

    db.commit()
    db.refresh(db_item)

    log_action(
        db, 
        current_user.id, 
        "ADJUST_INVENTORY", 
        "inventory_items", 
        item_id, 
        {
            "item_name": db_item.name,
            "quantity_change": adjustment.quantity_change,
            "old_quantity": old_qty,
            "new_quantity": new_qty,
            "reason": adjustment.reason
        }
    )
    return db_item
