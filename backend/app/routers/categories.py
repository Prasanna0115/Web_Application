from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.category import Category
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.access import ensure_restaurant_access

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_all_categories(db: Session = Depends(get_db)) -> list[Category]:
    query = (
        select(Category)
        .join(Restaurant)
        .where(Restaurant.is_active.is_(True))
        .order_by(Category.name, Category.restaurant_id)
    )
    return list(db.scalars(query))


@router.get("/{restaurant_id}", response_model=list[CategoryRead])
def list_categories(restaurant_id: int, db: Session = Depends(get_db)) -> list[Category]:
    return list(db.scalars(select(Category).where(Category.restaurant_id == restaurant_id).order_by(Category.name)))


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> Category:
    ensure_restaurant_access(db, user, payload.restaurant_id)
    category = Category(**payload.model_dump())
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists for this restaurant") from None
    return category


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    ensure_restaurant_access(db, user, category.restaurant_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists for this restaurant") from None
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> None:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    ensure_restaurant_access(db, user, category.restaurant_id)
    db.delete(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Move or remove this category's menu items before deleting it") from None
