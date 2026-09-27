from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

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
    license_days: int = 30

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

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

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
    return c

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
    total = subtotal + c.get("delivery_fee", 0)
    order = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "company_id": body.company_id,
        "company_name": c.get("name"),
        "items": [i.dict() for i in body.items],
        "subtotal": subtotal,
        "delivery_fee": c.get("delivery_fee", 0),
        "total": total,
        "notes": body.notes,
        "address": body.address,
        "payment_method": body.payment_method,
        "status": "placed",
        "whatsapp": c.get("whatsapp"),
        "created_at": now().isoformat(),
    }
    await db.orders.insert_one(dict(order))
    return order

@api.get("/orders/me")
async def my_orders(user=Depends(allow("customer"))):
    items = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

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

@app.on_event("shutdown")
async def shutdown():
    client.close()
