"""
ERP integration + api-key tests for Delivery Hub.

Covers:
- GET /api/company/api-key returns key for authenticated company user
- POST /api/company/api-key/regenerate rotates key
- X-API-Key auth on /api/erp/* (missing => 401, invalid => 401, deactivated company => 403)
- GET /api/erp/ping returns ok + company info
- POST /api/erp/products/bulk creates then upserts by external_id
- GET /api/erp/products lists company products
- GET /api/erp/orders + status filter
- PATCH /api/erp/orders/{id}/status updates via api key
- License options: license_days=365 (annual) works, license renewal accepts add_days=180 and 365
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://delivery-hub-manager.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@delivery.com"
ADMIN_PASSWORD = "Admin@12345"


class Ctx:
    admin_token: str = ""
    # primary ERP company (annual license)
    company_id: str = ""
    owner_email: str = ""
    owner_password: str = "Owner@12345"
    company_token: str = ""
    api_key: str = ""
    api_key_after_rotate: str = ""
    # customer for placing an order to test /erp/orders + status update
    customer_token: str = ""
    order_id: str = ""
    # extra company used to verify "deactivated => 403"
    deact_company_id: str = ""
    deact_owner_email: str = ""
    deact_api_key: str = ""


ctx = Ctx()


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def apikey(k: str):
    return {"X-API-Key": k}


# ---------- Setup: admin login + create annual-license company ----------
def test_admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    ctx.admin_token = r.json()["access_token"]


def test_create_company_annual_license_365():
    """license_days=365 (anual) must be accepted at company creation."""
    assert ctx.admin_token
    unique = uuid.uuid4().hex[:8]
    ctx.owner_email = f"TEST_erp_owner_{unique}@example.com"
    payload = {
        "name": f"TEST_ERP_Pizza {unique}",
        "segment": "food",
        "whatsapp": "5511977777777",
        "address": "Rua ERP 100",
        "owner_email": ctx.owner_email,
        "owner_password": ctx.owner_password,
        "owner_name": "ERP Owner",
        "plan": "premium",
        "license_days": 365,
        "delivery_fee": 7.0,
        "min_order": 25.0,
    }
    r = requests.post(f"{API}/admin/companies", json=payload, headers=auth(ctx.admin_token))
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["plan"] == "premium"
    assert c["active"] is True
    assert "api_key" in c and c["api_key"].startswith("ck_")
    ctx.company_id = c["id"]


def test_license_renewal_add_days_180():
    r = requests.patch(
        f"{API}/admin/companies/{ctx.company_id}/license",
        json={"plan": "premium", "add_days": 180},
        headers=auth(ctx.admin_token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["plan"] == "premium"


def test_license_renewal_add_days_365():
    r = requests.patch(
        f"{API}/admin/companies/{ctx.company_id}/license",
        json={"plan": "premium", "add_days": 365},
        headers=auth(ctx.admin_token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["plan"] == "premium"


# ---------- Company login & api-key endpoints ----------
def test_company_login():
    r = requests.post(f"{API}/auth/login", json={"email": ctx.owner_email, "password": ctx.owner_password})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "company"
    assert data["user"]["company_id"] == ctx.company_id
    ctx.company_token = data["access_token"]


def test_get_api_key():
    r = requests.get(f"{API}/company/api-key", headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "api_key" in data
    assert isinstance(data["api_key"], str) and data["api_key"].startswith("ck_")
    ctx.api_key = data["api_key"]


def test_regenerate_api_key_changes_value():
    r = requests.post(f"{API}/company/api-key/regenerate", headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    new_key = r.json()["api_key"]
    assert new_key.startswith("ck_")
    assert new_key != ctx.api_key, "regenerate must return a different key"
    ctx.api_key_after_rotate = new_key
    # verify GET now returns the new key (persistence)
    r2 = requests.get(f"{API}/company/api-key", headers=auth(ctx.company_token))
    assert r2.status_code == 200
    assert r2.json()["api_key"] == new_key
    # old key should no longer authenticate
    r3 = requests.get(f"{API}/erp/ping", headers=apikey(ctx.api_key))
    assert r3.status_code == 401
    ctx.api_key = new_key


def test_api_key_requires_company_role():
    """super_admin should NOT be able to fetch a company api-key (role gate)."""
    r = requests.get(f"{API}/company/api-key", headers=auth(ctx.admin_token))
    assert r.status_code == 403


# ---------- ERP: auth negative cases ----------
def test_erp_ping_missing_header_401():
    r = requests.get(f"{API}/erp/ping")
    assert r.status_code == 401


def test_erp_ping_invalid_key_401():
    r = requests.get(f"{API}/erp/ping", headers=apikey("ck_invalid_xxxxxxxx"))
    assert r.status_code == 401


# ---------- ERP: ping happy path ----------
def test_erp_ping_ok():
    r = requests.get(f"{API}/erp/ping", headers=apikey(ctx.api_key))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert data.get("company_id") == ctx.company_id
    assert isinstance(data.get("company"), str) and data["company"]


# ---------- ERP: bulk products (create then upsert by external_id) ----------
def test_erp_bulk_create_products():
    ext_a = f"EXT_{uuid.uuid4().hex[:6]}"
    ext_b = f"EXT_{uuid.uuid4().hex[:6]}"
    ctx.ext_a = ext_a  # type: ignore[attr-defined]
    ctx.ext_b = ext_b  # type: ignore[attr-defined]
    payload = [
        {"external_id": ext_a, "name": "TEST_ERP_Coke", "price": 8.0, "category": "Bebidas"},
        {"external_id": ext_b, "name": "TEST_ERP_Fries", "price": 15.5, "category": "Acompanhamentos"},
    ]
    r = requests.post(f"{API}/erp/products/bulk", json=payload, headers=apikey(ctx.api_key))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data == {"created": 2, "updated": 0, "total": 2}


def test_erp_bulk_upsert_same_external_ids():
    """Sending same external_ids should update -> created=0, updated=N."""
    payload = [
        {"external_id": ctx.ext_a, "name": "TEST_ERP_Coke_v2", "price": 9.0, "category": "Bebidas"},  # type: ignore[attr-defined]
        {"external_id": ctx.ext_b, "name": "TEST_ERP_Fries_v2", "price": 16.5, "category": "Acompanhamentos"},  # type: ignore[attr-defined]
    ]
    r = requests.post(f"{API}/erp/products/bulk", json=payload, headers=apikey(ctx.api_key))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 0
    assert data["updated"] == 2
    assert data["total"] == 2


def test_erp_list_products_contains_upserts_with_new_values():
    r = requests.get(f"{API}/erp/products", headers=apikey(ctx.api_key))
    assert r.status_code == 200, r.text
    items = r.json()
    by_ext = {p.get("external_id"): p for p in items if p.get("external_id")}
    assert ctx.ext_a in by_ext and by_ext[ctx.ext_a]["name"] == "TEST_ERP_Coke_v2" and by_ext[ctx.ext_a]["price"] == 9.0  # type: ignore[attr-defined]
    assert ctx.ext_b in by_ext and by_ext[ctx.ext_b]["price"] == 16.5  # type: ignore[attr-defined]
    # unique product id present
    ctx.product_id = by_ext[ctx.ext_a]["id"]  # type: ignore[attr-defined]


# ---------- ERP: orders list + status update ----------
def test_place_order_as_new_customer_for_erp_flow():
    unique = uuid.uuid4().hex[:8]
    body = {"email": f"TEST_erp_cust_{unique}@example.com", "password": "Cust@12345", "name": "ERP Cust", "phone": "5511966666666"}
    r = requests.post(f"{API}/auth/register-customer", json=body)
    assert r.status_code == 200, r.text
    ctx.customer_token = r.json()["access_token"]

    order = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_ERP_Coke_v2", "price": 9.0, "quantity": 3}],  # type: ignore[attr-defined]
        "notes": "erp test",
        "address": "Rua ERP Cliente",
        "payment_method": "money",
    }
    r2 = requests.post(f"{API}/orders", json=order, headers=auth(ctx.customer_token))
    assert r2.status_code == 200, r2.text
    ctx.order_id = r2.json()["id"]
    assert r2.json()["status"] == "placed"


def test_erp_list_orders_filter_placed():
    r = requests.get(f"{API}/erp/orders", params={"status": "placed"}, headers=apikey(ctx.api_key))
    assert r.status_code == 200, r.text
    items = r.json()
    ids = [o["id"] for o in items]
    assert ctx.order_id in ids
    for o in items:
        assert o["status"] == "placed"
        assert o["company_id"] == ctx.company_id


def test_erp_list_orders_no_filter():
    r = requests.get(f"{API}/erp/orders", headers=apikey(ctx.api_key))
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()]
    assert ctx.order_id in ids


def test_erp_patch_order_status_to_confirmed():
    r = requests.patch(
        f"{API}/erp/orders/{ctx.order_id}/status",
        json={"status": "confirmed"},
        headers=apikey(ctx.api_key),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"
    # verify via list filter
    r2 = requests.get(f"{API}/erp/orders", params={"status": "confirmed"}, headers=apikey(ctx.api_key))
    ids = [o["id"] for o in r2.json()]
    assert ctx.order_id in ids


def test_erp_patch_order_unknown_id_404():
    r = requests.patch(
        f"{API}/erp/orders/nonexistent-id/status",
        json={"status": "confirmed"},
        headers=apikey(ctx.api_key),
    )
    assert r.status_code == 404


# ---------- ERP: deactivated company => 403 ----------
def test_deactivated_company_erp_returns_403():
    """Create a temp company, get its api_key via owner login, then admin deactivates it, then /erp/ping must return 403."""
    unique = uuid.uuid4().hex[:8]
    ctx.deact_owner_email = f"TEST_erp_deact_{unique}@example.com"
    payload = {
        "name": f"TEST_ERP_Deact {unique}",
        "segment": "food",
        "whatsapp": "5511955555555",
        "address": "Rua Deact 1",
        "owner_email": ctx.deact_owner_email,
        "owner_password": "Owner@12345",
        "owner_name": "Deact Owner",
        "plan": "basic",
        "license_days": 30,
    }
    r = requests.post(f"{API}/admin/companies", json=payload, headers=auth(ctx.admin_token))
    assert r.status_code == 200, r.text
    c = r.json()
    ctx.deact_company_id = c["id"]

    # login as owner and fetch api key
    r2 = requests.post(f"{API}/auth/login", json={"email": ctx.deact_owner_email, "password": "Owner@12345"})
    assert r2.status_code == 200
    deact_owner_token = r2.json()["access_token"]
    r3 = requests.get(f"{API}/company/api-key", headers=auth(deact_owner_token))
    assert r3.status_code == 200
    ctx.deact_api_key = r3.json()["api_key"]

    # sanity: works while active
    r4 = requests.get(f"{API}/erp/ping", headers=apikey(ctx.deact_api_key))
    assert r4.status_code == 200

    # deactivate via admin
    r5 = requests.patch(
        f"{API}/admin/companies/{ctx.deact_company_id}",
        json={"active": False},
        headers=auth(ctx.admin_token),
    )
    assert r5.status_code == 200

    # now erp/ping must be 403
    r6 = requests.get(f"{API}/erp/ping", headers=apikey(ctx.deact_api_key))
    assert r6.status_code == 403, r6.text


# ---------- Cleanup ----------
def test_cleanup_delete_erp_companies():
    # delete primary erp company (cascades users + products)
    if ctx.company_id:
        r = requests.delete(f"{API}/admin/companies/{ctx.company_id}", headers=auth(ctx.admin_token))
        assert r.status_code == 200
    # delete deactivated erp company
    if ctx.deact_company_id:
        r2 = requests.delete(f"{API}/admin/companies/{ctx.deact_company_id}", headers=auth(ctx.admin_token))
        assert r2.status_code == 200
