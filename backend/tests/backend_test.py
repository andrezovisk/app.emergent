"""
Backend API integration tests for Delivery Hub.
Tests: auth (super_admin, company, customer), admin CRUD companies + license,
company products & orders, public stores, order placement, authorization enforcement,
and license/active-flag enforcement.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://delivery-hub-manager.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@delivery.com"
ADMIN_PASSWORD = "Admin@12345"


# ---------- shared state across tests ----------
class Ctx:
    admin_token: str = ""
    company_id: str = ""
    owner_email: str = ""
    owner_password: str = "Owner@12345"
    company_token: str = ""
    customer_token: str = ""
    customer_id: str = ""
    product_id: str = ""
    order_id: str = ""

ctx = Ctx()


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ---------- Health ----------
def test_health_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth: Super admin login ----------
def test_admin_login_success():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["token_type"] == "bearer"
    assert data["user"]["role"] == "super_admin"
    assert "password_hash" not in data["user"]
    ctx.admin_token = data["access_token"]


def test_admin_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# ---------- Admin stats ----------
def test_admin_stats_requires_super_admin():
    assert ctx.admin_token, "admin token missing"
    r = requests.get(f"{API}/admin/stats", headers=auth(ctx.admin_token))
    assert r.status_code == 200
    data = r.json()
    for key in ("total_companies", "active_companies", "total_users", "total_orders"):
        assert key in data
        assert isinstance(data[key], int)


def test_admin_stats_missing_token_401():
    r = requests.get(f"{API}/admin/stats")
    assert r.status_code == 401


# ---------- Admin: create company ----------
def test_create_company_and_owner():
    assert ctx.admin_token
    unique = uuid.uuid4().hex[:8]
    ctx.owner_email = f"TEST_owner_{unique}@example.com"
    payload = {
        "name": f"TEST_Pizza {unique}",
        "segment": "food",
        "whatsapp": "5511999999999",
        "address": "Rua Teste 123",
        "owner_email": ctx.owner_email,
        "owner_password": ctx.owner_password,
        "owner_name": "Test Owner",
        "plan": "pro",
        "license_days": 30,
        "delivery_fee": 5.5,
        "min_order": 20.0,
    }
    r = requests.post(f"{API}/admin/companies", json=payload, headers=auth(ctx.admin_token))
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["name"] == payload["name"]
    assert c["segment"] == "food"
    assert c["plan"] == "pro"
    assert c["active"] is True
    assert "license_expires_at" in c
    assert "id" in c
    ctx.company_id = c["id"]


def test_list_companies_contains_new():
    r = requests.get(f"{API}/admin/companies", headers=auth(ctx.admin_token))
    assert r.status_code == 200
    items = r.json()
    ids = [x["id"] for x in items]
    assert ctx.company_id in ids


def test_renew_license():
    body = {"plan": "premium", "add_days": 15}
    r = requests.patch(f"{API}/admin/companies/{ctx.company_id}/license", json=body, headers=auth(ctx.admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "premium"
    assert data["active"] is True
    # expiration should be in future
    exp = datetime.fromisoformat(data["license_expires_at"])
    assert exp > datetime.now(timezone.utc)


def test_toggle_active_false_and_back():
    # deactivate
    r = requests.patch(f"{API}/admin/companies/{ctx.company_id}", json={"active": False}, headers=auth(ctx.admin_token))
    assert r.status_code == 200
    assert r.json()["active"] is False
    # verify it disappears from public list
    r2 = requests.get(f"{API}/stores")
    assert r2.status_code == 200
    ids = [x["id"] for x in r2.json()]
    assert ctx.company_id not in ids
    # reactivate
    r3 = requests.patch(f"{API}/admin/companies/{ctx.company_id}", json={"active": True}, headers=auth(ctx.admin_token))
    assert r3.status_code == 200
    assert r3.json()["active"] is True


# ---------- Company owner login ----------
def test_company_owner_login():
    r = requests.post(f"{API}/auth/login", json={"email": ctx.owner_email, "password": ctx.owner_password})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "company"
    assert data["user"]["company_id"] == ctx.company_id
    ctx.company_token = data["access_token"]


def test_company_me():
    r = requests.get(f"{API}/company/me", headers=auth(ctx.company_token))
    assert r.status_code == 200
    assert r.json()["id"] == ctx.company_id


def test_company_stats():
    r = requests.get(f"{API}/company/stats", headers=auth(ctx.company_token))
    assert r.status_code == 200
    for k in ("total_orders", "today_orders", "products", "revenue"):
        assert k in r.json()


# ---------- Company product CRUD ----------
def test_create_product():
    body = {"name": "TEST_Pizza Margherita", "description": "Molho e mussarela", "price": 39.9, "category": "Pizzas"}
    r = requests.post(f"{API}/company/products", json=body, headers=auth(ctx.company_token))
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == body["name"]
    assert data["price"] == 39.9
    assert data["company_id"] == ctx.company_id
    ctx.product_id = data["id"]


def test_list_products_contains():
    r = requests.get(f"{API}/company/products", headers=auth(ctx.company_token))
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert ctx.product_id in ids


def test_update_product():
    r = requests.patch(f"{API}/company/products/{ctx.product_id}", json={"price": 42.5}, headers=auth(ctx.company_token))
    assert r.status_code == 200
    assert r.json()["price"] == 42.5


# ---------- Customer registration ----------
def test_register_customer():
    unique = uuid.uuid4().hex[:8]
    body = {"email": f"TEST_cust_{unique}@example.com", "password": "Cust@12345", "name": "Test Customer", "phone": "5511988888888"}
    r = requests.post(f"{API}/auth/register-customer", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "customer"
    assert "access_token" in data
    ctx.customer_token = data["access_token"]
    ctx.customer_id = data["user"]["id"]


# ---------- Public stores ----------
def test_list_stores_public_active_only():
    r = requests.get(f"{API}/stores")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert ctx.company_id in ids


def test_list_stores_segment_filter():
    r = requests.get(f"{API}/stores", params={"segment": "food"})
    assert r.status_code == 200
    for c in r.json():
        assert c["segment"] == "food"


def test_get_store_public():
    r = requests.get(f"{API}/stores/{ctx.company_id}")
    assert r.status_code == 200
    assert r.json()["id"] == ctx.company_id


def test_get_store_products_public():
    r = requests.get(f"{API}/stores/{ctx.company_id}/products")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert ctx.product_id in ids


# ---------- Order lifecycle ----------
def test_create_order_as_customer():
    body = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_Pizza Margherita", "price": 42.5, "quantity": 2}],
        "notes": "sem cebola",
        "address": "Rua do Cliente 45",
        "payment_method": "money",
    }
    r = requests.post(f"{API}/orders", json=body, headers=auth(ctx.customer_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["subtotal"] == 85.0
    assert data["delivery_fee"] == 5.5
    assert data["total"] == 90.5
    assert data["whatsapp"] == "5511999999999"
    assert data["status"] == "placed"
    ctx.order_id = data["id"]


def test_orders_me():
    r = requests.get(f"{API}/orders/me", headers=auth(ctx.customer_token))
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()]
    assert ctx.order_id in ids


def test_company_orders_and_status_update():
    r = requests.get(f"{API}/company/orders", headers=auth(ctx.company_token))
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()]
    assert ctx.order_id in ids
    # advance
    r2 = requests.patch(f"{API}/company/orders/{ctx.order_id}", json={"status": "confirmed"}, headers=auth(ctx.company_token))
    assert r2.status_code == 200
    assert r2.json()["status"] == "confirmed"


# ---------- Authorization enforcement ----------
def test_customer_cannot_call_admin_endpoint_403():
    r = requests.get(f"{API}/admin/stats", headers=auth(ctx.customer_token))
    assert r.status_code == 403


def test_customer_cannot_call_company_endpoint_403():
    r = requests.get(f"{API}/company/me", headers=auth(ctx.customer_token))
    assert r.status_code == 403


def test_missing_token_returns_401():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_company_cannot_call_admin_403():
    r = requests.get(f"{API}/admin/stats", headers=auth(ctx.company_token))
    assert r.status_code == 403


# ---------- License / active enforcement ----------
def test_inactive_company_blocks_order_and_hides_store():
    # deactivate
    r = requests.patch(f"{API}/admin/companies/{ctx.company_id}", json={"active": False}, headers=auth(ctx.admin_token))
    assert r.status_code == 200
    # store hidden
    r2 = requests.get(f"{API}/stores")
    ids = [x["id"] for x in r2.json()]
    assert ctx.company_id not in ids
    # order attempt fails 400
    body = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "x", "price": 10, "quantity": 1}],
    }
    r3 = requests.post(f"{API}/orders", json=body, headers=auth(ctx.customer_token))
    assert r3.status_code == 400
    # get store returns 404
    r4 = requests.get(f"{API}/stores/{ctx.company_id}")
    assert r4.status_code == 404


# ---------- Cleanup ----------
def test_cleanup_delete_product_and_company():
    # reactivate to allow product delete via company token path (not required, delete company cascades)
    requests.patch(f"{API}/admin/companies/{ctx.company_id}", json={"active": True}, headers=auth(ctx.admin_token))
    # delete product via company
    r = requests.delete(f"{API}/company/products/{ctx.product_id}", headers=auth(ctx.company_token))
    assert r.status_code == 200
    # delete company (cascades users + products)
    r2 = requests.delete(f"{API}/admin/companies/{ctx.company_id}", headers=auth(ctx.admin_token))
    assert r2.status_code == 200
