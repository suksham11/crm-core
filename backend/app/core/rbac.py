from enum import Enum
from app.models.user import UserRole


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
