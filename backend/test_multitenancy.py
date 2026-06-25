import sys
import os

# Adjust path to include the backend directory
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app, auto_migrate
from app.db.session import SessionLocal
from app.models.all_models import User, Employee, FinancialRevenue, FinancialExpense, Group
from app.core.security import verify_password

def run_tests():
    print("=== STARTING MULTI-TENANCY E2E TESTS ===")
    
    # Run migrations
    auto_migrate()
    
    client = TestClient(app)
    db = SessionLocal()
    
    try:
        # Clean previous test records
        db.query(Employee).filter(Employee.name.like("Test Emp %")).delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.description.like("Test Rev %")).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["admin_a", "admin_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.name.in_(["Grupo A", "Grupo B"])).delete(synchronize_session=False)
        db.commit()

        # 1. Create two groups (via admin)
        print("Logging in as Admin Master...")
        admin_login = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin"
        })
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        print("Creating Group A and Group B...")
        res_g1 = client.post("/api/groups", json={"name": "Grupo A"}, headers=admin_headers)
        assert res_g1.status_code == 200
        g1_id = res_g1.json()["id"]
        
        res_g2 = client.post("/api/groups", json={"name": "Grupo B"}, headers=admin_headers)
        assert res_g2.status_code == 200
        g2_id = res_g2.json()["id"]
        print(f"[SUCCESS] Group A (ID: {g1_id}) and Group B (ID: {g2_id}) created.")

        # 2. Create Admin Delegado for each group
        print("Registering Admin Delegado for Group A...")
        res_u1 = client.post("/api/auth/register", json={
            "username": "admin_a",
            "email": "admin_a@lira.com",
            "password": "password123",
            "role": "admin_delegado",
            "group_id": g1_id
        }, headers=admin_headers)
        assert res_u1.status_code == 200
        
        print("Registering Admin Delegado for Group B...")
        res_u2 = client.post("/api/auth/register", json={
            "username": "admin_b",
            "email": "admin_b@lira.com",
            "password": "password123",
            "role": "admin_delegado",
            "group_id": g2_id
        }, headers=admin_headers)
        assert res_u2.status_code == 200
        print("[SUCCESS] Admin Delegados registered.")

        # 3. Log in as admin_a and create an employee and financial revenue
        print("Logging in as admin_a...")
        login_a = client.post("/api/auth/login", json={"username": "admin_a", "password": "password123"})
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        print("Creating Employee under Group A...")
        res_emp_a = client.post("/api/employees", json={
            "name": "Test Emp A",
            "cpf": "999.999.999-01",
            "rg": "99.999.999-9",
            "dob": "1990-01-01",
            "civil_status": "solteiro",
            "nationality": "Brasileira",
            "email": "empa@lira.com",
            "phone": "99999-9999",
            "address_cep": "00000-000",
            "address_street": "Street A",
            "address_number": "1",
            "address_neighborhood": "Neighborhood A",
            "address_city": "City A",
            "address_state": "SP",
            "mother_name": "Mae A",
            "education": "superior",
            "contract": {
                "admission_date": "2024-01-01",
                "role": "Analista",
                "department": "TI",
                "base_salary": 4000.0
            }
        }, headers=headers_a)
        assert res_emp_a.status_code == 200
        emp_a_id = res_emp_a.json()["id"]
        
        print("Creating Financial Revenue under Group A...")
        res_rev_a = client.post("/api/financial/revenues", json={
            "description": "Test Rev A",
            "amount": 1500.0,
            "category": "Vendas",
            "date": "2024-06-01",
            "reference_month": 6,
            "reference_year": 2024
        }, headers=headers_a)
        print("res_rev_a status:", res_rev_a.status_code)
        print("res_rev_a body:", res_rev_a.text)
        assert res_rev_a.status_code in [200, 201]
        rev_a_id = res_rev_a.json()["id"]
        print("[SUCCESS] Data created under Group A.")

        # 4. Log in as admin_b and verify isolation
        print("Logging in as admin_b...")
        login_b = client.post("/api/auth/login", json={"username": "admin_b", "password": "password123"})
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print("Testing that admin_b CANNOT see Group A employees...")
        res_list_emp = client.get("/api/employees", headers=headers_b)
        assert res_list_emp.status_code == 200
        employees = res_list_emp.json()
        assert not any(e["id"] == emp_a_id for e in employees)
        print("[SUCCESS] Employee list isolation verified.")

        print("Testing that admin_b CANNOT fetch Group A employee details directly...")
        res_get_emp = client.get(f"/api/employees/{emp_a_id}", headers=headers_b)
        assert res_get_emp.status_code in [403, 404]
        print("[SUCCESS] Employee direct retrieval isolation verified.")

        print("Testing that admin_b CANNOT fetch Group A financial records...")
        res_list_rev = client.get("/api/financial/revenues", headers=headers_b)
        assert res_list_rev.status_code == 200
        revenues = res_list_rev.json()
        assert not any(r["id"] == rev_a_id for r in revenues)
        print("[SUCCESS] Financial list isolation verified.")

        # 5. Log in as Admin Master and verify global access
        print("Logging in as Admin Master again...")
        res_list_emp_admin = client.get("/api/employees", headers=admin_headers)
        assert res_list_emp_admin.status_code == 200
        employees_admin = res_list_emp_admin.json()
        assert any(e["id"] == emp_a_id for e in employees_admin)
        print("[SUCCESS] Admin Master can see Group A employee.")
        
        # Clean up
        db.query(Employee).filter(Employee.id == emp_a_id).delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.id == rev_a_id).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["admin_a", "admin_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.id.in_([g1_id, g2_id])).delete(synchronize_session=False)
        db.commit()
        print("Cleanup completed.")
        print("=== ALL TENANT ISOLATION TESTS PASSED SUCCESSFULLY ===")

    except Exception as e:
        print("=== TESTS FAILED ===")
        import traceback
        traceback.print_exc()
        db.rollback()
        # Clean up on failure
        db.query(Employee).filter(Employee.name.like("Test Emp %")).delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.description.like("Test Rev %")).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["admin_a", "admin_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.name.in_(["Grupo A", "Grupo B"])).delete(synchronize_session=False)
        db.commit()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
