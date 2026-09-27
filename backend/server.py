from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets as pysecrets
import jwt
import bcrypt
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from fastapi import Header

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
ACCESS_MINUTES = int(os.environ.get("ACCESS_MINUTES", "1440"))
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Delivery Hub API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

Role = Literal["super_admin", "company", "customer"]
PlanTier = Literal["basic", "pro", "premium"]
OrderStatus = Literal["placed", "confirmed", "preparing", "delivered", "cancelled"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("delivery")

# ---------- utils ----------
def now() -> datetime:
    return datetime.now(timezone.utc)

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(12)).decode()

def check_pw(pw: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), stored.encode())
    except Exception:
        return False

def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "company_id": user.get("company_id"),
        "iat": now(),
        "exp": now() + timedelta(minutes=ACCESS_MINUTES),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not cred:
        raise HTTPException(401, "Missing token")
    try:
        claims = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": claims["sub"], "active": True}, {"_id": 0})
        if not user or user["role"] != claims["role"]:
            raise ValueError("bad user")
        return user
    except Exception as e:
        raise HTTPException(401, "Invalid or expired token")

def allow(*roles: Role):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient role")
        return user
    return dep

# ---------- models ----------
class RegisterCustomer(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str
    phone: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class CompanyCreate(BaseModel):
    name: str
    segment: str  # food, market, pharmacy, etc
    whatsapp: str  # phone with country code e.g. 5511999999999
    address: str
    cover_image: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    delivery_fee: float = 0.0
    min_order: float = 0.0
    delivery_time: Optional[str] = "30-45 min"
    # owner user
    owner_email: EmailStr
    owner_password: str = Field(min_length=6, max_length=72)
    owner_name: str
    # license
    plan: PlanTier = "basic"
    license_days: int = 30  # 30/90/180/365 = mensal/trimestral/semestral/anual

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    segment: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    cover_image: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    delivery_fee: Optional[float] = None
    min_order: Optional[float] = None
    delivery_time: Optional[str] = None
    active: Optional[bool] = None

class LicenseUpdate(BaseModel):
    plan: PlanTier
    add_days: int = 30

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    category: str = "Geral"
    image: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image: Optional[str] = None
    active: Optional[bool] = None

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int

class OrderCreate(BaseModel):
    company_id: str
    items: List[OrderItem]
    notes: Optional[str] = ""
    address: Optional[str] = ""
    payment_method: Optional[str] = "money"
    coupon_code: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class CouponCreate(BaseModel):
    code: str
    discount_type: Literal["percent", "fixed"] = "percent"
    value: float
    min_order: float = 0
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None  # ISO
    active: bool = True

class CouponUpdate(BaseModel):
    discount_type: Optional[Literal["percent", "fixed"]] = None
    value: Optional[float] = None
    min_order: Optional[float] = None
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    active: Optional[bool] = None

class CouponValidateIn(BaseModel):
    company_id: str
    code: str
    subtotal: float

class CompanySettings(BaseModel):
    webhook_url: Optional[str] = None

# ---------- helpers ----------
def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

async def company_license_valid(company_id: str) -> Optional[dict]:
    c = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not c:
        return None
    if not c.get("active", True):
        return None
    exp = c.get("license_expires_at")
    if exp and isinstance(exp, str):
        try:
            exp_dt = datetime.fromisoformat(exp)
        except Exception:
            return None
    else:
        exp_dt = exp
    if exp_dt and exp_dt < now():
        return None
    return c

async def apply_coupon(company_id: str, code: str, subtotal: float) -> tuple[Optional[dict], float, Optional[str]]:
    """Returns (coupon_doc_or_none, discount_amount, error_message)."""
    if not code:
        return None, 0.0, None
    code_norm = code.strip().upper()
    coupon = await db.coupons.find_one({"company_id": company_id, "code": code_norm})
    if not coupon:
        return None, 0.0, "Cupom não encontrado"
    if not coupon.get("active", True):
        return None, 0.0, "Cupom desativado"
    exp = coupon.get("expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp) < now():
                return None, 0.0, "Cupom expirado"
        except Exception:
            pass
    if subtotal < coupon.get("min_order", 0):
        return None, 0.0, f"Pedido mínimo de R$ {coupon['min_order']:.2f} para este cupom"
    max_uses = coupon.get("max_uses")
    if max_uses and coupon.get("uses", 0) >= max_uses:
        return None, 0.0, "Cupom esgotado"
    if coupon["discount_type"] == "percent":
        discount = subtotal * (coupon["value"] / 100.0)
    else:
        discount = min(subtotal, coupon["value"])
    return coupon, round(discount, 2), None

async def send_webhook(company: dict, order: dict):
    url = (company or {}).get("webhook_url")
    if not url:
        return
    try:
        import httpx  # local import
        async with httpx.AsyncClient(timeout=5.0) as cli:
            await cli.post(url, json={"event": "order.created", "order": order})
    except Exception as e:
        log.warning(f"webhook failed for {company.get('id')}: {e}")

# ---------- routes: auth ----------
@api.get("/")
async def root():
    return {"message": "Delivery Hub API", "status": "ok"}

@api.post("/auth/register-customer")
async def register_customer(body: RegisterCustomer):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Email já cadastrado")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_pw(body.password),
        "role": "customer",
        "name": body.name,
        "phone": body.phone,
        "company_id": None,
        "active": True,
        "created_at": now().isoformat(),
    }
    await db.users.insert_one(user)
    token = make_token(user)
    return {"access_token": token, "token_type": "bearer", "user": clean(dict(user))}

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha inválidos")
    if not user.get("active", True):
        raise HTTPException(403, "Usuário desativado")
    token = make_token(user)
    return {"access_token": token, "token_type": "bearer", "user": clean(dict(user))}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return clean(dict(user))

# ---------- routes: super admin ----------
@api.get("/admin/stats")
async def admin_stats(user=Depends(allow("super_admin"))):
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"active": True})
    total_users = await db.users.count_documents({})
    total_orders = await db.orders.count_documents({})
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_users": total_users,
        "total_orders": total_orders,
    }

@api.get("/admin/companies")
async def list_companies(user=Depends(allow("super_admin"))):
    items = await db.companies.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/admin/companies")
async def create_company(body: CompanyCreate, user=Depends(allow("super_admin"))):
    # check owner email
    if await db.users.find_one({"email": body.owner_email.lower()}):
        raise HTTPException(409, "Email do proprietário já cadastrado")
    company_id = str(uuid.uuid4())
    license_expires = now() + timedelta(days=body.license_days)
    company = {
        "id": company_id,
        "name": body.name,
        "segment": body.segment,
        "whatsapp": body.whatsapp,
        "address": body.address,
        "cover_image": body.cover_image,
        "logo": body.logo,
        "description": body.description or "",
        "delivery_fee": body.delivery_fee,
        "min_order": body.min_order,
        "delivery_time": body.delivery_time,
        "plan": body.plan,
        "license_expires_at": license_expires.isoformat(),
        "active": True,
        "api_key": "ck_" + pysecrets.token_urlsafe(28),
        "created_at": now().isoformat(),
    }
    await db.companies.insert_one(dict(company))
    owner = {
        "id": str(uuid.uuid4()),
        "email": body.owner_email.lower(),
        "password_hash": hash_pw(body.owner_password),
        "role": "company",
        "name": body.owner_name,
        "company_id": company_id,
        "active": True,
        "created_at": now().isoformat(),
    }
    await db.users.insert_one(dict(owner))
    return clean(dict(company))

@api.patch("/admin/companies/{company_id}")
async def update_company(company_id: str, body: CompanyUpdate, user=Depends(allow("super_admin"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nada a atualizar")
    r = await db.companies.update_one({"id": company_id}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Empresa não encontrada")
    c = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return c

@api.patch("/admin/companies/{company_id}/license")
async def update_license(company_id: str, body: LicenseUpdate, user=Depends(allow("super_admin"))):
    c = await db.companies.find_one({"id": company_id})
    if not c:
        raise HTTPException(404, "Empresa não encontrada")
    current_exp = c.get("license_expires_at")
    if current_exp:
        try:
            base = datetime.fromisoformat(current_exp)
            if base < now():
                base = now()
        except Exception:
            base = now()
    else:
        base = now()
    new_exp = base + timedelta(days=body.add_days)
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"plan": body.plan, "license_expires_at": new_exp.isoformat(), "active": True}},
    )
    return await db.companies.find_one({"id": company_id}, {"_id": 0})

@api.delete("/admin/companies/{company_id}")
async def delete_company(company_id: str, user=Depends(allow("super_admin"))):
    await db.companies.delete_one({"id": company_id})
    await db.users.delete_many({"company_id": company_id})
    await db.products.delete_many({"company_id": company_id})
    return {"ok": True}

# ---------- routes: company ----------
@api.get("/company/me")
async def company_me(user=Depends(allow("company"))):
    c = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Empresa não encontrada")
    # attach days_until_expiration
    exp = c.get("license_expires_at")
    if exp:
        try:
            delta = datetime.fromisoformat(exp) - now()
            c["days_until_expiration"] = max(0, delta.days)
            c["license_expired"] = delta.total_seconds() < 0
        except Exception:
            c["days_until_expiration"] = None
            c["license_expired"] = False
    return c

@api.patch("/company/settings")
async def company_update_settings(body: CompanySettings, user=Depends(allow("company"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nada a atualizar")
    await db.companies.update_one({"id": user["company_id"]}, {"$set": update})
    return await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})

@api.get("/company/stats")
async def company_stats(user=Depends(allow("company"))):
    cid = user["company_id"]
    total = await db.orders.count_documents({"company_id": cid})
    today = now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.orders.count_documents({"company_id": cid, "created_at": {"$gte": today.isoformat()}})
    products = await db.products.count_documents({"company_id": cid})
    pipe = [{"$match": {"company_id": cid, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": None, "sum": {"$sum": "$total"}}}]
    agg = await db.orders.aggregate(pipe).to_list(1)
    revenue = agg[0]["sum"] if agg else 0
    return {"total_orders": total, "today_orders": today_orders, "products": products, "revenue": revenue}

@api.get("/company/products")
async def company_products(user=Depends(allow("company"))):
    items = await db.products.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/company/products")
async def create_product(body: ProductCreate, user=Depends(allow("company"))):
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "name": body.name,
        "description": body.description or "",
        "price": body.price,
        "category": body.category,
        "image": body.image,
        "active": True,
        "created_at": now().isoformat(),
    }
    await db.products.insert_one(dict(doc))
    return doc

@api.patch("/company/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, user=Depends(allow("company"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nada a atualizar")
    r = await db.products.update_one({"id": product_id, "company_id": user["company_id"]}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Produto não encontrado")
    return await db.products.find_one({"id": product_id}, {"_id": 0})

@api.delete("/company/products/{product_id}")
async def delete_product(product_id: str, user=Depends(allow("company"))):
    await db.products.delete_one({"id": product_id, "company_id": user["company_id"]})
    return {"ok": True}

@api.get("/company/orders")
async def company_orders(user=Depends(allow("company"))):
    items = await db.orders.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.patch("/company/orders/{order_id}")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user=Depends(allow("company"))):
    r = await db.orders.update_one({"id": order_id, "company_id": user["company_id"]}, {"$set": {"status": body.status}})
    if not r.matched_count:
        raise HTTPException(404, "Pedido não encontrado")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

# ---------- routes: coupons (company) ----------
@api.get("/company/coupons")
async def list_coupons(user=Depends(allow("company"))):
    items = await db.coupons.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/company/coupons")
async def create_coupon(body: CouponCreate, user=Depends(allow("company"))):
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(400, "Código inválido")
    exists = await db.coupons.find_one({"company_id": user["company_id"], "code": code})
    if exists:
        raise HTTPException(409, "Já existe um cupom com esse código")
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "code": code,
        "discount_type": body.discount_type,
        "value": body.value,
        "min_order": body.min_order,
        "max_uses": body.max_uses,
        "expires_at": body.expires_at,
        "active": body.active,
        "uses": 0,
        "created_at": now().isoformat(),
    }
    await db.coupons.insert_one(dict(doc))
    return doc

@api.patch("/company/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, body: CouponUpdate, user=Depends(allow("company"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nada a atualizar")
    r = await db.coupons.update_one({"id": coupon_id, "company_id": user["company_id"]}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Cupom não encontrado")
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})

@api.delete("/company/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, user=Depends(allow("company"))):
    await db.coupons.delete_one({"id": coupon_id, "company_id": user["company_id"]})
    return {"ok": True}


# ---------- routes: customer / public ----------
@api.get("/stores")
async def list_stores(segment: Optional[str] = None):
    q: dict = {"active": True}
    if segment and segment != "all":
        q["segment"] = segment
    items = await db.companies.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # filter out expired licenses
    valid = []
    for c in items:
        exp = c.get("license_expires_at")
        if exp:
            try:
                if datetime.fromisoformat(exp) > now():
                    valid.append(c)
            except Exception:
                pass
    return valid

@api.get("/stores/{company_id}")
async def get_store(company_id: str):
    c = await company_license_valid(company_id)
    if not c:
        raise HTTPException(404, "Loja indisponível")
    return c

@api.get("/stores/{company_id}/products")
async def get_store_products(company_id: str):
    c = await company_license_valid(company_id)
    if not c:
        raise HTTPException(404, "Loja indisponível")
    items = await db.products.find({"company_id": company_id, "active": True}, {"_id": 0}).to_list(500)
    return items

@api.post("/orders")
async def create_order(body: OrderCreate, user=Depends(allow("customer"))):
    c = await company_license_valid(body.company_id)
    if not c:
        raise HTTPException(400, "Loja indisponível")
    subtotal = sum(i.price * i.quantity for i in body.items)
    delivery_fee = c.get("delivery_fee", 0)
    coupon_doc, discount, coupon_err = await apply_coupon(body.company_id, body.coupon_code or "", subtotal)
    if body.coupon_code and coupon_err:
        raise HTTPException(400, coupon_err)
    total = max(0.0, subtotal - discount) + delivery_fee
    order = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "company_id": body.company_id,
        "company_name": c.get("name"),
        "items": [i.dict() for i in body.items],
        "subtotal": subtotal,
        "discount": discount,
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "delivery_fee": delivery_fee,
        "total": total,
        "notes": body.notes,
        "address": body.address,
        "payment_method": body.payment_method,
        "status": "placed",
        "whatsapp": c.get("whatsapp"),
        "created_at": now().isoformat(),
    }
    await db.orders.insert_one(dict(order))
    if coupon_doc:
        await db.coupons.update_one({"id": coupon_doc["id"]}, {"$inc": {"uses": 1}})
    # fire webhook asynchronously
    asyncio.create_task(send_webhook(c, order))
    return order

@api.post("/coupons/validate")
async def validate_coupon(body: CouponValidateIn):
    coupon, discount, err = await apply_coupon(body.company_id, body.code, body.subtotal)
    if err:
        raise HTTPException(400, err)
    return {"code": coupon["code"], "discount": discount, "discount_type": coupon["discount_type"], "value": coupon["value"]}

@api.get("/orders/me")
async def my_orders(user=Depends(allow("customer"))):
    items = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

# ---------- routes: company api-key ----------
@api.get("/company/api-key")
async def company_get_api_key(user=Depends(allow("company"))):
    c = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0, "api_key": 1})
    if not c:
        raise HTTPException(404, "Empresa não encontrada")
    return {"api_key": c.get("api_key")}

@api.post("/company/api-key/regenerate")
async def company_regen_api_key(user=Depends(allow("company"))):
    new_key = "ck_" + pysecrets.token_urlsafe(28)
    await db.companies.update_one({"id": user["company_id"]}, {"$set": {"api_key": new_key}})
    return {"api_key": new_key}

# ---------- routes: ERP integration (X-API-Key auth) ----------
async def erp_company(x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    if not x_api_key:
        raise HTTPException(401, "X-API-Key header ausente")
    c = await db.companies.find_one({"api_key": x_api_key}, {"_id": 0})
    if not c:
        raise HTTPException(401, "API key inválida")
    if not c.get("active", True):
        raise HTTPException(403, "Empresa desativada")
    exp = c.get("license_expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp) < now():
                raise HTTPException(403, "Licença expirada")
        except HTTPException:
            raise
        except Exception:
            pass
    return c

class ErpProductIn(BaseModel):
    external_id: Optional[str] = None  # id do ERP para upsert
    name: str
    description: Optional[str] = ""
    price: float
    category: str = "Geral"
    image: Optional[str] = None
    active: bool = True

@api.get("/erp/ping")
async def erp_ping(c=Depends(erp_company)):
    return {"ok": True, "company": c["name"], "company_id": c["id"]}

@api.get("/erp/products")
async def erp_list_products(c=Depends(erp_company)):
    items = await db.products.find({"company_id": c["id"]}, {"_id": 0}).to_list(2000)
    return items

@api.post("/erp/products/bulk")
async def erp_bulk_products(products: List[ErpProductIn], c=Depends(erp_company)):
    """Envie uma lista de produtos do seu ERP. Se external_id existir, atualiza; senão cria."""
    created, updated = 0, 0
    for p in products:
        base = {
            "name": p.name,
            "description": p.description or "",
            "price": p.price,
            "category": p.category,
            "image": p.image,
            "active": p.active,
            "company_id": c["id"],
            "external_id": p.external_id,
        }
        if p.external_id:
            existing = await db.products.find_one({"company_id": c["id"], "external_id": p.external_id})
            if existing:
                await db.products.update_one({"id": existing["id"]}, {"$set": base})
                updated += 1
                continue
        base["id"] = str(uuid.uuid4())
        base["created_at"] = now().isoformat()
        await db.products.insert_one(dict(base))
        created += 1
    return {"created": created, "updated": updated, "total": created + updated}

@api.get("/erp/orders")
async def erp_list_orders(status: Optional[str] = None, since: Optional[str] = None, c=Depends(erp_company)):
    q: dict = {"company_id": c["id"]}
    if status:
        q["status"] = status
    if since:
        q["created_at"] = {"$gte": since}
    items = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

class ErpOrderStatus(BaseModel):
    status: OrderStatus

@api.patch("/erp/orders/{order_id}/status")
async def erp_update_order_status(order_id: str, body: ErpOrderStatus, c=Depends(erp_company)):
    r = await db.orders.update_one({"id": order_id, "company_id": c["id"]}, {"$set": {"status": body.status}})
    if not r.matched_count:
        raise HTTPException(404, "Pedido não encontrado")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

# ---------- app ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # unique index on email
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.companies.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.coupons.create_index([("company_id", 1), ("code", 1)], unique=True)
    # seed super admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "role": "super_admin",
            "name": "Super Admin",
            "company_id": None,
            "active": True,
            "created_at": now().isoformat(),
        }
        await db.users.insert_one(admin)
        log.info(f"Seeded super admin: {ADMIN_EMAIL}")
    # Backfill api_key for existing companies
    async for comp in db.companies.find({"api_key": {"$in": [None, ""]}}, {"id": 1}):
        await db.companies.update_one({"id": comp["id"]}, {"$set": {"api_key": "ck_" + pysecrets.token_urlsafe(28)}})
    await db.companies.create_index("api_key")
    await db.products.create_index([("company_id", 1), ("external_id", 1)])

@app.on_event("shutdown")
async def shutdown():
    client.close()
