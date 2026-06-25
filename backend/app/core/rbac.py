from enum import Enum
from functools import wraps

from fastapi import HTTPException, status


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    SALES_REP = "sales_rep"


ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.SALES_REP: 0,
    UserRole.MANAGER: 1,
    UserRole.ADMIN: 2,
}


def role_ge(required_role: UserRole) -> bool:
    def check(current_role: str) -> bool:
        current = UserRole(current_role)
        return ROLE_HIERARCHY.get(current, -1) >= ROLE_HIERARCHY.get(required_role, 999)
    return check


def require_role(required_role: UserRole):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def can_manage_leads(user_role: str) -> bool:
    return role_ge(UserRole.MANAGER)(user_role)


def can_delete_leads(user_role: str) -> bool:
    return role_ge(UserRole.MANAGER)(user_role)


def can_manage_users(user_role: str) -> bool:
    return user_role == UserRole.ADMIN.value


def can_view_reports(user_role: str) -> bool:
    return role_ge(UserRole.MANAGER)(user_role)
