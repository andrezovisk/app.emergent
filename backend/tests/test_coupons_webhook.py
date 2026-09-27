"""
Tests for new features: coupons per company, webhook_url on company settings,
and license expiration warning fields on GET /api/company/me.

Covers:
- GET /api/company/me returns days_until_expiration (int) and license_expired (bool)
- PATCH /api/company/settings with webhook_url updates it; GET /api/company/me returns webhook_url
- POST /api/company/coupons creates coupon (code uppercased); duplicate code -> 409
- GET /api/company/coupons lists coupons
- PATCH /api/company/coupons/{id} updates fields (active=false etc.)
- DELETE /api/company/coupons/{id} removes it
- POST /api/coupons/validate (public): valid code returns discount; percent vs fixed logic
- POST /api/coupons/validate 400 for: unknown, inactive, expired, below min_order, max_uses reached
- POST /api/orders with coupon_code: applies discount; increments uses; total math correct
- POST /api/orders with invalid coupon_code returns 400 and order NOT created
- Webhook: unreachable URL does NOT fail order creation (best-effort async)
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


class Ctx:
    admin_token: str = ""
    company_id: str = ""
    owner_email: str = ""
    owner_password: str = "Owner@12345"
    company_token: str = ""
    product_id: str = ""
    customer_token: str = ""
    customer_email: str = ""

    # coupons created for this run
    coupon_percent_id: str = ""
    coupon_percent_code: str = ""
    coupon_fixed_id: str = ""
    coupon_fixed_code: str = ""
    coupon_expired_id: str = ""
    coupon_expired_code: str = ""
    coupon_inactive_id: str = ""
    coupon_inactive_code: str = ""
    coupon_maxuses_id: str = ""
    coupon_maxuses_code: str = ""
    coupon_delete_id: str = ""
    coupon_update_id: str = ""


ctx = Ctx()


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ---------- Setup ----------
def test_admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    ctx.admin_token = r.json()["access_token"]


def test_create_company_and_login():
    unique = uuid.uuid4().hex[:8]
    ctx.owner_email = f"TEST_cpn_owner_{unique}@example.com"
    payload = {
        "name": f"TEST_CPN_Pizza {unique}",
        "segment": "food",
        "whatsapp": "5511900000000",
        "address": "Rua Cupom 1",
        "owner_email": ctx.owner_email,
        "owner_password": ctx.owner_password,
        "owner_name": "Cpn Owner",
        "plan": "pro",
        "license_days": 30,
        "delivery_fee": 5.0,
        "min_order": 0.0,
    }
    r = requests.post(f"{API}/admin/companies", json=payload, headers=auth(ctx.admin_token))
    assert r.status_code == 200, r.text
    ctx.company_id = r.json()["id"]

    r2 = requests.post(f"{API}/auth/login", json={"email": ctx.owner_email, "password": ctx.owner_password})
    assert r2.status_code == 200
    ctx.company_token = r2.json()["access_token"]


def test_create_product_for_orders():
    body = {"name": "TEST_CPN_Item", "price": 50.0, "category": "Comida"}
    r = requests.post(f"{API}/company/products", json=body, headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    ctx.product_id = r.json()["id"]


def test_register_customer():
    unique = uuid.uuid4().hex[:8]
    ctx.customer_email = f"TEST_cpn_cust_{unique}@example.com"
    body = {"email": ctx.customer_email, "password": "Cust@12345", "name": "Cpn Cust", "phone": "5511911111111"}
    r = requests.post(f"{API}/auth/register-customer", json=body)
    assert r.status_code == 200, r.text
    ctx.customer_token = r.json()["access_token"]


# ---------- GET /api/company/me: expiration fields ----------
def test_company_me_has_expiration_fields():
    r = requests.get(f"{API}/company/me", headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "days_until_expiration" in data, "days_until_expiration missing"
    assert "license_expired" in data, "license_expired missing"
    assert isinstance(data["days_until_expiration"], int), f"expected int, got {type(data['days_until_expiration'])}"
    assert isinstance(data["license_expired"], bool), f"expected bool, got {type(data['license_expired'])}"
    # 30 day license: expect ~30 (within 29-30 range) and not expired
    assert data["license_expired"] is False
    assert 28 <= data["days_until_expiration"] <= 30, f"days_until_expiration unexpected: {data['days_until_expiration']}"


# ---------- PATCH /api/company/settings: webhook_url ----------
def test_patch_settings_webhook_url_reflected_in_me():
    webhook = "https://httpbin.org/post"
    r = requests.patch(f"{API}/company/settings", json={"webhook_url": webhook}, headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("webhook_url") == webhook

    r2 = requests.get(f"{API}/company/me", headers=auth(ctx.company_token))
    assert r2.status_code == 200
    assert r2.json().get("webhook_url") == webhook


# ---------- POST /api/company/coupons: create + uppercase + duplicate 409 ----------
def test_create_coupon_percent_code_uppercased():
    code_lower = f"promo{uuid.uuid4().hex[:6]}"
    body = {"code": code_lower, "discount_type": "percent", "value": 10, "min_order": 20, "active": True}
    r = requests.post(f"{API}/company/coupons", json=body, headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["code"] == code_lower.upper(), f"code not uppercased: {data['code']}"
    assert data["discount_type"] == "percent"
    assert data["value"] == 10
    assert data["min_order"] == 20
    assert data["active"] is True
    assert data["uses"] == 0
    assert data["company_id"] == ctx.company_id
    ctx.coupon_percent_id = data["id"]
    ctx.coupon_percent_code = data["code"]


def test_create_coupon_fixed():
    code = f"FIX{uuid.uuid4().hex[:6].upper()}"
    body = {"code": code, "discount_type": "fixed", "value": 15, "min_order": 0}
    r = requests.post(f"{API}/company/coupons", json=body, headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["discount_type"] == "fixed"
    assert data["value"] == 15
    ctx.coupon_fixed_id = data["id"]
    ctx.coupon_fixed_code = data["code"]


def test_create_coupon_duplicate_returns_409():
    # Duplicate of coupon_percent_code (case-insensitive: send lowercase, backend uppercases)
    body = {"code": ctx.coupon_percent_code.lower(), "discount_type": "percent", "value": 5}
    r = requests.post(f"{API}/company/coupons", json=body, headers=auth(ctx.company_token))
    assert r.status_code == 409, r.text


# ---------- GET /api/company/coupons ----------
def test_list_coupons_contains_created():
    r = requests.get(f"{API}/company/coupons", headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    codes = [c["code"] for c in r.json()]
    assert ctx.coupon_percent_code in codes
    assert ctx.coupon_fixed_code in codes


# ---------- PATCH /api/company/coupons/{id} ----------
def test_update_coupon_active_false():
    # Create a fresh coupon to update
    code = f"UPD{uuid.uuid4().hex[:6].upper()}"
    r0 = requests.post(f"{API}/company/coupons", json={"code": code, "discount_type": "percent", "value": 5},
                       headers=auth(ctx.company_token))
    assert r0.status_code == 200
    ctx.coupon_update_id = r0.json()["id"]

    r = requests.patch(f"{API}/company/coupons/{ctx.coupon_update_id}", json={"active": False},
                       headers=auth(ctx.company_token))
    assert r.status_code == 200, r.text
    assert r.json()["active"] is False
    # value unchanged
    assert r.json()["value"] == 5


# ---------- DELETE /api/company/coupons/{id} ----------
def test_delete_coupon_removes_it():
    code = f"DEL{uuid.uuid4().hex[:6].upper()}"
    r0 = requests.post(f"{API}/company/coupons", json={"code": code, "discount_type": "percent", "value": 5},
                       headers=auth(ctx.company_token))
    assert r0.status_code == 200
    ctx.coupon_delete_id = r0.json()["id"]

    r = requests.delete(f"{API}/company/coupons/{ctx.coupon_delete_id}", headers=auth(ctx.company_token))
    assert r.status_code == 200
    # verify absent from list
    r2 = requests.get(f"{API}/company/coupons", headers=auth(ctx.company_token))
    ids = [c["id"] for c in r2.json()]
    assert ctx.coupon_delete_id not in ids


# ---------- POST /api/coupons/validate (public) ----------
def test_validate_percent_coupon_ok():
    # 10% * 100 = 10
    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id,
        "code": ctx.coupon_percent_code,
        "subtotal": 100.0,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["code"] == ctx.coupon_percent_code
    assert data["discount_type"] == "percent"
    assert data["value"] == 10
    assert data["discount"] == 10.0


def test_validate_fixed_coupon_ok_and_capped_by_subtotal():
    # fixed 15, subtotal 100 => discount 15
    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id,
        "code": ctx.coupon_fixed_code,
        "subtotal": 100.0,
    })
    assert r.status_code == 200, r.text
    assert r.json()["discount"] == 15.0

    # fixed 15, subtotal 10 => discount capped at 10 (min(subtotal, value))
    r2 = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id,
        "code": ctx.coupon_fixed_code,
        "subtotal": 10.0,
    })
    assert r2.status_code == 200
    assert r2.json()["discount"] == 10.0


def test_validate_unknown_code_400():
    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id,
        "code": "NOPE_DOES_NOT_EXIST_XYZ",
        "subtotal": 100.0,
    })
    assert r.status_code == 400


def test_validate_inactive_400():
    code = f"INA{uuid.uuid4().hex[:6].upper()}"
    r0 = requests.post(f"{API}/company/coupons",
                       json={"code": code, "discount_type": "percent", "value": 10, "active": False},
                       headers=auth(ctx.company_token))
    assert r0.status_code == 200
    ctx.coupon_inactive_id = r0.json()["id"]
    ctx.coupon_inactive_code = code

    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id, "code": code, "subtotal": 100.0,
    })
    assert r.status_code == 400


def test_validate_expired_400():
    code = f"EXP{uuid.uuid4().hex[:6].upper()}"
    past = "2020-01-01T00:00:00+00:00"
    r0 = requests.post(f"{API}/company/coupons",
                       json={"code": code, "discount_type": "percent", "value": 10, "expires_at": past},
                       headers=auth(ctx.company_token))
    assert r0.status_code == 200
    ctx.coupon_expired_id = r0.json()["id"]
    ctx.coupon_expired_code = code

    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id, "code": code, "subtotal": 100.0,
    })
    assert r.status_code == 400


def test_validate_below_min_order_400():
    # coupon_percent has min_order=20; subtotal=10 should fail
    r = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id,
        "code": ctx.coupon_percent_code,
        "subtotal": 10.0,
    })
    assert r.status_code == 400


def test_validate_max_uses_reached_400():
    """Create coupon with max_uses=1, place an order using it, then validate again -> 400."""
    code = f"MAX{uuid.uuid4().hex[:6].upper()}"
    r0 = requests.post(f"{API}/company/coupons",
                       json={"code": code, "discount_type": "fixed", "value": 5, "max_uses": 1},
                       headers=auth(ctx.company_token))
    assert r0.status_code == 200
    ctx.coupon_maxuses_id = r0.json()["id"]
    ctx.coupon_maxuses_code = code

    # first validate should pass (uses=0 < 1)
    r1 = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id, "code": code, "subtotal": 50.0,
    })
    assert r1.status_code == 200

    # consume it via an order
    order = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_CPN_Item", "price": 50.0, "quantity": 1}],
        "coupon_code": code,
        "address": "R Consumo",
        "payment_method": "money",
    }
    ro = requests.post(f"{API}/orders", json=order, headers=auth(ctx.customer_token))
    assert ro.status_code == 200, ro.text
    # subtotal 50 - discount 5 + delivery 5 = 50
    assert ro.json()["discount"] == 5.0
    assert ro.json()["coupon_code"] == code
    assert ro.json()["total"] == 50.0

    # now validate again should fail
    r2 = requests.post(f"{API}/coupons/validate", json={
        "company_id": ctx.company_id, "code": code, "subtotal": 50.0,
    })
    assert r2.status_code == 400


# ---------- POST /api/orders with coupon ----------
def test_order_with_percent_coupon_applies_discount_and_increments_uses():
    # snapshot current uses of coupon_percent
    r0 = requests.get(f"{API}/company/coupons", headers=auth(ctx.company_token))
    before = next(c for c in r0.json() if c["id"] == ctx.coupon_percent_id)
    uses_before = before.get("uses", 0)

    order = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_CPN_Item", "price": 50.0, "quantity": 2}],
        "coupon_code": ctx.coupon_percent_code.lower(),  # verify case-insensitive
        "address": "Rua Cliente",
        "payment_method": "money",
    }
    r = requests.post(f"{API}/orders", json=order, headers=auth(ctx.customer_token))
    assert r.status_code == 200, r.text
    data = r.json()
    # subtotal = 100, discount = 10% * 100 = 10, delivery_fee = 5, total = 95
    assert data["subtotal"] == 100.0
    assert data["discount"] == 10.0
    assert data["delivery_fee"] == 5.0
    assert data["total"] == 95.0
    assert data["coupon_code"] == ctx.coupon_percent_code
    assert data["status"] == "placed"

    # uses incremented
    r1 = requests.get(f"{API}/company/coupons", headers=auth(ctx.company_token))
    after = next(c for c in r1.json() if c["id"] == ctx.coupon_percent_id)
    assert after["uses"] == uses_before + 1


def test_order_with_invalid_coupon_400_and_no_order_created():
    # count orders before
    r_before = requests.get(f"{API}/company/orders", headers=auth(ctx.company_token))
    before_ids = {o["id"] for o in r_before.json()}

    order = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_CPN_Item", "price": 50.0, "quantity": 1}],
        "coupon_code": "TOTALLY_INVALID_CODE_ZZZ",
        "address": "Rua X",
        "payment_method": "money",
    }
    r = requests.post(f"{API}/orders", json=order, headers=auth(ctx.customer_token))
    assert r.status_code == 400, r.text

    # verify no new order got persisted
    r_after = requests.get(f"{API}/company/orders", headers=auth(ctx.company_token))
    after_ids = {o["id"] for o in r_after.json()}
    assert after_ids == before_ids, "order was persisted despite invalid coupon"


# ---------- Webhook: unreachable URL must not fail order ----------
def test_webhook_unreachable_url_does_not_fail_order():
    # set an unreachable webhook_url
    bad_url = "http://127.0.0.1:1/does_not_exist"
    rp = requests.patch(f"{API}/company/settings", json={"webhook_url": bad_url}, headers=auth(ctx.company_token))
    assert rp.status_code == 200
    assert rp.json().get("webhook_url") == bad_url

    order = {
        "company_id": ctx.company_id,
        "items": [{"product_id": ctx.product_id, "name": "TEST_CPN_Item", "price": 50.0, "quantity": 1}],
        "address": "Rua Webhook",
        "payment_method": "money",
    }
    r = requests.post(f"{API}/orders", json=order, headers=auth(ctx.customer_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "placed"


# ---------- License expired: simulate by admin deactivating past-date (approximation) ----------
# We can't easily set license to past via public API; skip strict test but ensure the fields exist,
# which is verified in test_company_me_has_expiration_fields.


# ---------- Cleanup ----------
def test_cleanup_delete_company():
    if ctx.company_id:
        r = requests.delete(f"{API}/admin/companies/{ctx.company_id}", headers=auth(ctx.admin_token))
        assert r.status_code == 200
