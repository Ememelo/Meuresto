import uuid
from sqlalchemy.orm import Session
from app.models.all_models import Sector, JobPosition

def prepopulate_restaurant_defaults(db: Session, group_id: str):
    # Check if there are already sectors for this group
    existing_sectors_count = db.query(Sector).filter(Sector.group_id == group_id).count()
    if existing_sectors_count > 0:
        return  # Already populated or has custom entries

    # Default sectors structure
    defaults = {
        "Cozinha": {
            "description": "Setor responsável pela preparação dos alimentos, pratos e controle da praça quente/fria.",
            "roles": [
                {"name": "Chef de Cozinha", "base_salary": 4500.0, "description": "Liderança da cozinha, elaboração de cardápios e controle de qualidade."},
                {"name": "Sub-Chef de Cozinha", "base_salary": 3200.0, "description": "Auxílio ao chef na supervisão da equipe e preparação."},
                {"name": "Cozinheiro", "base_salary": 2400.0, "description": "Preparação e finalização dos pratos da praça quente/fria."},
                {"name": "Auxiliar de Cozinha", "base_salary": 1700.0, "description": "Limpeza de insumos, organização da cozinha e tarefas gerais de apoio."}
            ]
        },
        "Salão": {
            "description": "Setor de atendimento direto ao cliente, mesas e delivery.",
            "roles": [
                {"name": "Maitre / Supervisor", "base_salary": 2800.0, "description": "Coordenação do salão, recepção de clientes e controle do serviço."},
                {"name": "Garçom", "base_salary": 1850.0, "description": "Atendimento às mesas, apresentação do cardápio e venda ativa."},
                {"name": "Cumim (Auxiliar de Salão)", "base_salary": 1600.0, "description": "Organização do salão, transporte de pratos e limpeza de mesas."},
                {"name": "Hostess / Recepcionista", "base_salary": 1800.0, "description": "Recepção dos clientes na entrada e organização da fila de espera."}
            ]
        },
        "Bar": {
            "description": "Setor de preparo de bebidas, drinks e coquetéis.",
            "roles": [
                {"name": "Bartender / Barman", "base_salary": 2200.0, "description": "Preparo de coquetéis, controle de estoque de bebidas e atendimento do bar."},
                {"name": "Auxiliar de Bar", "base_salary": 1650.0, "description": "Organização do balcão, reposição de gelo, frutas e copos."}
            ]
        },
        "Administração": {
            "description": "Gestão financeira, compras, recursos humanos e controle geral do caixa.",
            "roles": [
                {"name": "Gerente Geral", "base_salary": 5000.0, "description": "Gerenciamento completo da operação, faturamento e equipe do restaurante."},
                {"name": "Caixa / Operador de Caixa", "base_salary": 1900.0, "description": "Fechamento de contas dos clientes, conciliação e controle do fluxo diário."},
                {"name": "Auxiliar Administrativo", "base_salary": 2000.0, "description": "Controle de compras, notas fiscais, contas a pagar e suporte geral."}
            ]
        },
        "Limpeza e Manutenção": {
            "description": "Higienização geral do restaurante, banheiros, salão e lavagem de utensílios (Steward).",
            "roles": [
                {"name": "Steward (Lavador de Pratos)", "base_salary": 1600.0, "description": "Higienização de pratos, panelas, talheres e utensílios da cozinha."},
                {"name": "Auxiliar de Limpeza / Faxina", "base_salary": 1600.0, "description": "Limpeza do salão, banheiros, vestiários e áreas comuns do restaurante."}
            ]
        }
    }

    try:
        for sector_name, info in defaults.items():
            sector_id = str(uuid.uuid4())
            db_sector = Sector(
                id=sector_id,
                group_id=group_id,
                name=sector_name,
                description=info["description"],
                is_active=True
            )
            db.add(db_sector)
            
            for role in info["roles"]:
                role_id = str(uuid.uuid4())
                db_role = JobPosition(
                    id=role_id,
                    group_id=group_id,
                    sector_id=sector_id,
                    name=role["name"],
                    base_salary=role["base_salary"],
                    description=role["description"],
                    level="Operacional" if sector_name != "Administração" else "Supervisão"
                )
                db.add(db_role)
                
        db.commit()
        print(f"[Restaurant Defaults] Pré-cadastro concluído com sucesso para o grupo: {group_id}")
    except Exception as e:
        db.rollback()
        print(f"[Restaurant Defaults] Erro ao pré-cadastrar setores e funções: {e}")
