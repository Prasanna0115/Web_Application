from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.category import Category
from app.models.menu_item import MenuItem
from app.models.user import User, UserRole
from app.schemas.menu_item import MenuItemCreate, MenuItemRead, MenuItemUpdate
from app.services.access import ensure_restaurant_access

router = APIRouter(prefix="/menu", tags=["menu"])


def validate_category(db: Session, restaurant_id: int, category_id: int) -> None:
    category = db.get(Category, category_id)
    if category is None or category.restaurant_id != restaurant_id:
        raise HTTPException(status_code=422, detail="Category must belong to the selected restaurant")


@router.get("/{restaurant_id}", response_model=list[MenuItemRead])
def list_menu(restaurant_id: int, db: Session = Depends(get_db)) -> list[MenuItem]:
    return list(
        db.scalars(
            select(MenuItem)
            .where(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available.is_(True))
            .order_by(MenuItem.name)
        )
    )


@router.get("/manage/{restaurant_id}", response_model=list[MenuItemRead])
def list_managed_menu(
    restaurant_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> list[MenuItem]:
    ensure_restaurant_access(db, user, restaurant_id)
    return list(db.scalars(select(MenuItem).where(MenuItem.restaurant_id == restaurant_id).order_by(MenuItem.name)))


@router.get("/item/{item_id}", response_model=MenuItemRead)
def get_menu_item(item_id: int, db: Session = Depends(get_db)) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None or not item.is_available:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


@router.post("", response_model=MenuItemRead, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    payload: MenuItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> MenuItem:
    ensure_restaurant_access(db, user, payload.restaurant_id)
    validate_category(db, payload.restaurant_id, payload.category_id)
    item = MenuItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=MenuItemRead)
def update_menu_item(
    item_id: int,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    ensure_restaurant_access(db, user, item.restaurant_id)
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        validate_category(db, item.restaurant_id, updates["category_id"])
    for key, value in updates.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> None:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    ensure_restaurant_access(db, user, item.restaurant_id)
    item.is_available = False
    db.commit()
