from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import LoginRequest


def authenticate_user(db: Session, payload: LoginRequest) -> tuple[User, str] | None:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        return None
    token = create_access_token(sub=str(user.id), role=user.role.value)
    return user, token
