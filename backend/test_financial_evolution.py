import sys
import os
import json
from datetime import date, datetime, timedelta

# Adjust path to include the backend directory
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app, auto_migrate
from app.db.session import SessionLocal
from app.models.all_models import User, Supplier, FinancialRevenue, FinancialExpense, Group

def run_tests():
    print("=== STARTING FINANCIAL EVOLUTION E2E TESTS ===")
    
    # Run migrations to make sure schema is up-to-date
    auto_migrate()
    
    client = TestClient(app)
    db = SessionLocal()
    
    try:
        # Clean previous test records
        db.query(Supplier).filter(Supplier.trade_name.like("Test Supp%")).delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.description.like("Test Rev%")).delete(synchronize_session=False)
        db.query(FinancialExpense).filter(FinancialExpense.description.like("Test Exp%")).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["fin_user_a", "fin_user_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.name.in_(["Grupo Financeiro A", "Grupo Financeiro B"])).delete(synchronize_session=False)
        db.commit()

        # Log in as Admin Master to set up test environment
        print("Logging in as Admin Master...")
        admin_login = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin"
        })
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Create Tenant Groups
        print("Creating test groups...")
        res_g1 = client.post("/api/groups", json={"name": "Grupo Financeiro A"}, headers=admin_headers)
        assert res_g1.status_code == 200
        g1_id = res_g1.json()["id"]
        
        res_g2 = client.post("/api/groups", json={"name": "Grupo Financeiro B"}, headers=admin_headers)
        assert res_g2.status_code == 200
        g2_id = res_g2.json()["id"]
        print(f"Created Group A (ID: {g1_id}) and Group B (ID: {g2_id}).")

        # 2. Register users for each group
        print("Registering users...")
        res_u1 = client.post("/api/auth/register", json={
            "username": "fin_user_a",
            "email": "fin_user_a@test.com",
            "password": "password123",
            "role": "admin_delegado",
            "group_id": g1_id
        }, headers=admin_headers)
        assert res_u1.status_code == 200
        
        res_u2 = client.post("/api/auth/register", json={
            "username": "fin_user_b",
            "email": "fin_user_b@test.com",
            "password": "password123",
            "role": "admin_delegado",
            "group_id": g2_id
        }, headers=admin_headers)
        assert res_u2.status_code == 200

        # Log in as User A
        login_a = client.post("/api/auth/login", json={"username": "fin_user_a", "password": "password123"})
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Log in as User B
        login_b = client.post("/api/auth/login", json={"username": "fin_user_b", "password": "password123"})
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 3. Test Supplier CRUD and Multi-tenancy Isolation
        print("\n--- Testing Supplier CRUD & Isolation ---")
        supplier_data_a = {
            "corporate_name": "Test Supplier A Ltda",
            "trade_name": "Test Supp A",
            "cnpj": "12.345.678/0001-90",
            "category": "Carnes",
            "preferred_payment_method": "PIX",
            "is_active": True
        }
        res_supp_a = client.post("/api/suppliers", json=supplier_data_a, headers=headers_a)
        assert res_supp_a.status_code == 201
        supp_a_id = res_supp_a.json()["id"]
        print(f"[SUCCESS] Created Supplier A (ID: {supp_a_id}) under Group A.")

        # Test duplicate CNPJ check in same group
        print("Testing duplicate CNPJ check...")
        res_supp_dup = client.post("/api/suppliers", json=supplier_data_a, headers=headers_a)
        assert res_supp_dup.status_code == 400
        assert "Já existe um fornecedor cadastrado com este CNPJ" in res_supp_dup.json()["detail"]
        print("[SUCCESS] Duplicate CNPJ check returned 400 Bad Request.")

        # Test multi-tenancy isolation for suppliers (User B should not see Supplier A)
        print("Testing supplier multi-tenancy isolation...")
        res_list_supp_b = client.get("/api/suppliers", headers=headers_b)
        assert res_list_supp_b.status_code == 200
        assert not any(s["id"] == supp_a_id for s in res_list_supp_b.json())
        
        # User B tries to fetch Supplier A details directly
        res_get_supp_b = client.get(f"/api/suppliers/{supp_a_id}", headers=headers_b)
        assert res_get_supp_b.status_code in [403, 404]
        print("[SUCCESS] Supplier isolation confirmed (User B cannot see User A's supplier).")

        # User A updates supplier details
        supplier_update = supplier_data_a.copy()
        supplier_update["trade_name"] = "Test Supp A Updated"
        res_update_supp = client.put(f"/api/suppliers/{supp_a_id}", json=supplier_update, headers=headers_a)
        assert res_update_supp.status_code == 200
        assert res_update_supp.json()["trade_name"] == "Test Supp A Updated"
        print("[SUCCESS] Supplier updated.")

        # 4. Test Financial Revenue Status and Calculations (Pendente vs Recebido)
        print("\n--- Testing Financial Revenue Status & Calculations ---")
        
        # Check starting summary for current year/month
        today = date.today()
        summary_url = f"/api/financial/summary?year={today.year}&month={today.month}"
        
        res_summary_init = client.get(summary_url, headers=headers_a)
        assert res_summary_init.status_code == 200
        init_cash = res_summary_init.json()["cash_balance"]
        init_pending_rec = res_summary_init.json()["pending_receivables"]
        print(f"Initial Cash Balance: {init_cash}, Pending Receivables: {init_pending_rec}")

        # Post a revenue as "A Receber" (Expected)
        revenue_pending = {
            "description": "Test Rev Expected",
            "amount": 2500.0,
            "category": "Vendas",
            "date": str(today),
            "expected_date": str(today),
            "status": "A Receber",
            "client": "Cliente Teste"
        }
        res_rev_p = client.post("/api/financial/revenues", json=revenue_pending, headers=headers_a)
        assert res_rev_p.status_code == 201
        rev_p_id = res_rev_p.json()["id"]
        
        # Verify summary: pending_receivables should increase, cash_balance should NOT change
        res_summary_p = client.get(summary_url, headers=headers_a)
        assert res_summary_p.json()["cash_balance"] == init_cash
        assert res_summary_p.json()["pending_receivables"] == init_pending_rec + 2500.0
        print("[SUCCESS] Pending revenue added to forecasts without changing cash balance.")

        # Update status to "Recebido"
        revenue_received = revenue_pending.copy()
        revenue_received["status"] = "Recebido"
        res_rev_update = client.put(f"/api/financial/revenues/{rev_p_id}", json=revenue_received, headers=headers_a)
        assert res_rev_update.status_code == 200
        assert res_rev_update.json()["status"] == "Recebido"
        
        # Verify history log on revenue update
        history = json.loads(res_rev_update.json()["change_history"])
        assert len(history) > 1
        assert "changes" in history[-1]
        assert history[-1]["changes"]["status"] == ["A Receber", "Recebido"]
        print("[SUCCESS] Change history correctly logged status transition.")

        # Verify summary again: cash_balance should increase, pending_receivables should return to initial
        res_summary_r = client.get(summary_url, headers=headers_a)
        assert res_summary_r.json()["cash_balance"] == init_cash + 2500.0
        assert res_summary_r.json()["pending_receivables"] == init_pending_rec
        print("[SUCCESS] Received revenue updated cash balance and cleared from pending.")

        # 5. Test Financial Expense Status, Supplier Reference, and Calculations (Pendente vs Pago)
        print("\n--- Testing Financial Expense Status & Calculations ---")
        
        # Post an expense as "Pendente"
        expense_pending = {
            "description": "Test Exp Pendente",
            "amount": 1000.0,
            "category": "Compras: Carnes",
            "date": str(today),
            "due_date": str(today),
            "status": "Pendente",
            "supplier_id": supp_a_id,
            "is_recurring": False
        }
        res_exp_p = client.post("/api/financial/expenses", json=expense_pending, headers=headers_a)
        assert res_exp_p.status_code == 201
        exp_p_id = res_exp_p.json()["id"]

        # Verify summary: pending_payables should increase, cash_balance should NOT change
        res_summary_ep = client.get(summary_url, headers=headers_a)
        assert res_summary_ep.json()["cash_balance"] == init_cash + 2500.0
        assert res_summary_ep.json()["pending_payables"] == 1000.0
        print("[SUCCESS] Pending expense added to forecasts without changing cash balance.")

        # Update status to "Pago"
        expense_paid = expense_pending.copy()
        expense_paid["status"] = "Pago"
        res_exp_update = client.put(f"/api/financial/expenses/{exp_p_id}", json=expense_paid, headers=headers_a)
        assert res_exp_update.status_code == 200
        assert res_exp_update.json()["status"] == "Pago"
        
        # Verify summary: cash_balance should decrease, pending_payables should clear
        res_summary_er = client.get(summary_url, headers=headers_a)
        assert res_summary_er.json()["cash_balance"] == init_cash + 2500.0 - 1000.0
        assert res_summary_er.json()["pending_payables"] == 0.0
        print("[SUCCESS] Paid expense updated cash balance and cleared from pending.")

        # 6. Test Deletion Block for Finalized Records
        print("\n--- Testing Deletion Block ---")
        
        # Try to delete paid expense (status "Pago")
        res_del_exp_fail = client.delete(f"/api/financial/expenses/{exp_p_id}", headers=headers_a)
        assert res_del_exp_fail.status_code == 400
        assert "Movimentações pagas ou canceladas não podem ser excluídas" in res_del_exp_fail.json()["detail"]
        print("[SUCCESS] Blocked deletion of paid expense.")

        # Try to delete received revenue (status "Recebido")
        res_del_rev_fail = client.delete(f"/api/financial/revenues/{rev_p_id}", headers=headers_a)
        assert res_del_rev_fail.status_code == 400
        assert "Movimentações recebidas ou canceladas não podem ser excluídas" in res_del_rev_fail.json()["detail"]
        print("[SUCCESS] Blocked deletion of received revenue.")

        # Update revenue to "Cancelado" and test deletion block
        revenue_cancelled = revenue_received.copy()
        revenue_cancelled["status"] = "Cancelado"
        client.put(f"/api/financial/revenues/{rev_p_id}", json=revenue_cancelled, headers=headers_a)
        
        res_del_rev_cancel_fail = client.delete(f"/api/financial/revenues/{rev_p_id}", headers=headers_a)
        assert res_del_rev_cancel_fail.status_code == 400
        print("[SUCCESS] Blocked deletion of cancelled revenue.")

        # Update expense to "Pendente" to allow deletion
        expense_reverted = expense_paid.copy()
        expense_reverted["status"] = "Pendente"
        client.put(f"/api/financial/expenses/{exp_p_id}", json=expense_reverted, headers=headers_a)
        
        # Try to delete now
        res_del_exp_ok = client.delete(f"/api/financial/expenses/{exp_p_id}", headers=headers_a)
        assert res_del_exp_ok.status_code == 204
        print("[SUCCESS] Reverted pending expense deleted successfully.")

        # 7. Test Recurring Expense Generation
        print("\n--- Testing Recurring Expense Generation ---")
        
        # Post a recurring expense with status "Pendente"
        expense_recur = {
            "description": "Test Exp Recorrente",
            "amount": 450.0,
            "category": "Estrutura: Energia",
            "date": str(today),
            "due_date": str(today),
            "status": "Pendente",
            "supplier_id": supp_a_id,
            "is_recurring": True,
            "recurrence_period": "mensal"
        }
        res_recur_init = client.post("/api/financial/expenses", json=expense_recur, headers=headers_a)
        assert res_recur_init.status_code == 201
        recur_id = res_recur_init.json()["id"]

        # Get number of expenses before payment
        expenses_before = len(client.get("/api/financial/expenses", headers=headers_a).json())

        # Update status to "Pago" to trigger next month's installment
        expense_recur_paid = expense_recur.copy()
        expense_recur_paid["status"] = "Pago"
        res_recur_pay = client.put(f"/api/financial/expenses/{recur_id}", json=expense_recur_paid, headers=headers_a)
        assert res_recur_pay.status_code == 200

        # Retrieve expenses list after payment
        expenses_after_list = client.get("/api/financial/expenses", headers=headers_a).json()
        assert len(expenses_after_list) == expenses_before + 1
        
        # Find the auto-generated expense
        generated_exp = [e for e in expenses_after_list if e["id"] != recur_id and e["description"] == "Test Exp Recorrente"][0]
        
        # Verify the generated expense details
        assert generated_exp["status"] == "Pendente"
        assert generated_exp["is_recurring"] is True
        assert generated_exp["amount"] == 450.0
        assert generated_exp["supplier_id"] == supp_a_id
        
        # Calculate expected next month date
        try:
            expected_next_date = today.replace(month=today.month + 1)
        except ValueError:
            if today.month == 12:
                expected_next_date = today.replace(year=today.year + 1, month=1)
            else:
                expected_next_date = today + timedelta(days=30)
                
        assert generated_exp["due_date"] == str(expected_next_date)
        print("[SUCCESS] Next monthly installment automatically created with status Pendente and due date in the next cycle.")

        # Clean up database records
        print("\n--- Cleaning up test data ---")
        db.query(FinancialExpense).filter(FinancialExpense.description == "Test Exp Recorrente").delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.id == rev_p_id).delete(synchronize_session=False)
        db.query(Supplier).filter(Supplier.id == supp_a_id).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["fin_user_a", "fin_user_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.id.in_([g1_id, g2_id])).delete(synchronize_session=False)
        db.commit()
        print("Cleanup completed.")
        print("=== ALL FINANCIAL EVOLUTION TESTS PASSED SUCCESSFULLY ===")

    except Exception as e:
        print("=== TESTS FAILED ===")
        import traceback
        traceback.print_exc()
        db.rollback()
        # Ensure cleanup on failure
        db.query(Supplier).filter(Supplier.trade_name.like("Test Supp%")).delete(synchronize_session=False)
        db.query(FinancialRevenue).filter(FinancialRevenue.description.like("Test Rev%")).delete(synchronize_session=False)
        db.query(FinancialExpense).filter(FinancialExpense.description.like("Test Exp%")).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["fin_user_a", "fin_user_b"])).delete(synchronize_session=False)
        db.query(Group).filter(Group.name.in_(["Grupo Financeiro A", "Grupo Financeiro B"])).delete(synchronize_session=False)
        db.commit()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
