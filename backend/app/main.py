from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.api.v1 import leads, auth, users
from app.core.security import hash_password
from app.models.user import User, UserRole

settings = get_settings()


def seed_admin_user() -> None:
    email = settings.bootstrap_admin_email.strip().lower()
    password = settings.bootstrap_admin_password.strip()
    if not email or not password:
        return

    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            return

        has_any_user = db.query(User.id).first() is not None
        if has_any_user:
            return

        role = UserRole(settings.bootstrap_admin_role)
        admin_user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=settings.bootstrap_admin_full_name,
            role=role,
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_admin_user()
    yield


app = FastAPI(
    title="CRM Core API",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "healthy", "environment": settings.environment}
