import re
from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.db.session import get_db
from app.models.all_models import User
from app.schemas.all_schemas import (
    Token, LoginRequest, UserResponse, UserCreate, PasswordChangeRequest,
    AdminPasswordResetRequest, ForgotPasswordRequest, UserRoleUpdateRequest
)
from app.services.audit_service import log_action

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

def validate_email_format(email: str):
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400,
            detail="Formato de e-mail inválido. Utilize um formato padrão como exemplo@dominio.com."
        )

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para realizar esta ação."
            )
        return current_user

# Endpoint para Login
@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos."
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo.")
        
    access_token = create_access_token(subject=user.username)
    log_action(db, user.id, "USER_LOGIN", "users", user.id)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

# Criar Novo Usuário (Apenas Admin)
@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    validate_email_format(user_in.email)
    if user_in.role == "admin":
        raise HTTPException(
            status_code=400,
            detail="O perfil Administrador (Master) é exclusivo e não pode ser concedido a outros usuários."
        )
    existing_user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Usuário com este nome de usuário ou e-mail já existe."
        )
    
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    log_action(
        db, 
        current_user.id, 
        "CREATE_USER", 
        "users", 
        db_user.id, 
        {"username": db_user.username, "role": db_user.role}
    )
    
    return db_user

# Cadastro Público de Novo Usuário
@router.post("/signup", response_model=UserResponse)
def signup(
    user_in: UserCreate,
    db: Session = Depends(get_db)
):
    validate_email_format(user_in.email)
    if user_in.role == "admin":
        raise HTTPException(
            status_code=400,
            detail="O perfil Administrador (Master) é exclusivo e não pode ser concedido a outros usuários."
        )
    existing_user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Usuário com este nome de usuário ou e-mail já existe."
        )
    
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    log_action(
        db, 
        None, 
        "USER_SIGNUP", 
        "users", 
        db_user.id, 
        {"username": db_user.username, "role": db_user.role}
    )
    
    return db_user


# Obter dados do usuário logado
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Alterar Senha
@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha antiga incorreta.")
        
    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()
    log_action(db, current_user.id, "CHANGE_PASSWORD", "users", current_user.id)
    return {"message": "Senha alterada com sucesso."}

# Listar todos os usuários (Apenas Admin)
@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    return db.query(User).all()

# Ativar/Desativar Usuário (Apenas Admin)
@router.put("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar seu próprio usuário.")
    user.is_active = not user.is_active
    db.commit()
    log_action(db, current_user.id, "TOGGLE_USER_ACTIVE", "users", user_id, {"username": user.username, "active": user.is_active})
    return {"message": "Status do usuário alterado com sucesso.", "is_active": user.is_active}


# Esqueci a Senha (Público)
@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.username == req.username,
        User.email == req.email
    ).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Nenhum usuário ativo encontrado com o nome de usuário e e-mail fornecidos."
        )
    user.password_reset_requested = True
    db.commit()
    log_action(db, user.id, "REQUEST_PASSWORD_RESET", "users", user.id)
    return {"message": "Solicitação de redefinição de senha enviada para o administrador master."}


# Resetar Senha de Outro Usuário (Apenas Admin)
@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str,
    req: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    user.password_hash = get_password_hash(req.new_password)
    user.password_reset_requested = False
    db.commit()
    log_action(db, current_user.id, "ADMIN_RESET_PASSWORD", "users", user_id, {"username": user.username})
    return {"message": f"Senha do usuário {user.username} redefinida com sucesso."}


# Alterar Nível de Acesso de Outro Usuário (Apenas Admin)
@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    req: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode alterar seu próprio nível de acesso.")
    if req.role == "admin":
        raise HTTPException(status_code=400, detail="O perfil Administrador (Master) é exclusivo e não pode ser concedido a outros usuários.")
        
    old_role = user.role
    user.role = req.role
    db.commit()
    log_action(db, current_user.id, "UPDATE_USER_ROLE", "users", user_id, {"username": user.username, "old_role": old_role, "new_role": req.role})
    return {"message": f"Nível de acesso do usuário {user.username} atualizado para {req.role} com sucesso."}


# Alternar Acesso Financeiro de Outro Usuário (Apenas Admin)
@router.put("/users/{user_id}/toggle-financial-access")
def toggle_user_financial_access(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="O administrador sempre possui acesso financeiro.")
        
    user.has_financial_access = not user.has_financial_access
    db.commit()
    log_action(db, current_user.id, "TOGGLE_USER_FINANCIAL_ACCESS", "users", user_id, {"username": user.username, "financial_access": user.has_financial_access})
    return {"message": "Status de acesso financeiro atualizado com sucesso.", "has_financial_access": user.has_financial_access}


# Excluir Conta de Usuário (Apenas Admin)
@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir seu próprio usuário.")
        
    username = user.username
    db.delete(user)
    db.commit()
    log_action(db, current_user.id, "DELETE_USER", "users", user_id, {"username": username})
    return {"message": f"Usuário {username} excluído com sucesso."}
