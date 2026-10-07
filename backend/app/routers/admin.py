from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.schemas.order import OrderRead
from app.schemas.restaurant import RestaurantRead
from app.schemas.user import UserRead, UserUpdate

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None}
    if target.id == user.id and ("role" in updates or updates.get("is_active") is False):
        raise HTTPException(status_code=409, detail="You cannot change your own role or deactivate your own account")
    loses_last_super_admin = (
        target.role == UserRole.SUPER_ADMIN
        and (updates.get("role") not in (None, UserRole.SUPER_ADMIN) or updates.get("is_active") is False)
        and (db.scalar(select(func.count(User.id)).where(
            User.role == UserRole.SUPER_ADMIN,
            User.is_active.is_(True),
            User.id != target.id,
        )) or 0) == 0
    )
    if loses_last_super_admin:
        raise HTTPException(status_code=409, detail="At least one active super administrator must remain")
    for key, value in updates.items():
        setattr(target, key, value)
    db.commit()
    db.refresh(target)
    return target


@router.get("/restaurants", response_model=list[RestaurantRead])
def list_managed_restaurants(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> list[Restaurant]:
    query = select(Restaurant).order_by(Restaurant.name)
    if user.role == UserRole.RESTAURANT_ADMIN:
        query = query.where(Restaurant.owner_id == user.id)
    return list(db.scalars(query))


@router.get("/orders", response_model=list[OrderRead])
def list_all_orders(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> list[Order]:
    query = select(Order).order_by(Order.created_at.desc())
    if user.role == UserRole.RESTAURANT_ADMIN:
        query = query.join(Restaurant).where(Restaurant.owner_id == user.id)
    return list(db.scalars(query))


@router.get("/statistics")
def statistics(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> dict[str, int | float]:
    user_count = db.scalar(select(func.count(User.id))) or 0
    restaurant_count = db.scalar(select(func.count(Restaurant.id))) or 0
    order_count = db.scalar(select(func.count(Order.id))) or 0
    revenue = db.scalar(select(func.coalesce(func.sum(Order.total_amount), 0)).where(Order.status != "CANCELLED")) or 0
    return {
        "users": user_count,
        "restaurants": restaurant_count,
        "orders": order_count,
        "revenue": float(revenue),
    }
