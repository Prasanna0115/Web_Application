from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.schemas.restaurant import RestaurantCreate, RestaurantRead, RestaurantUpdate
from app.services.access import ensure_restaurant_access

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


def validate_owner(db: Session, owner_id: int | None) -> None:
    if owner_id is None:
        return
    owner = db.get(User, owner_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Restaurant administrator not found")
    if owner.role != UserRole.RESTAURANT_ADMIN:
        raise HTTPException(status_code=422, detail="Restaurant ownership can only be assigned to a restaurant administrator")


@router.get("", response_model=list[RestaurantRead])
def list_restaurants(city: str | None = None, db: Session = Depends(get_db)) -> list[Restaurant]:
    query = select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.name)
    if city:
        query = query.where(Restaurant.city.ilike(f"%{city.strip()}%"))
    return list(db.scalars(query))


@router.get("/{restaurant_id}", response_model=RestaurantRead)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)) -> Restaurant:
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.post("", response_model=RestaurantRead, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> Restaurant:
    owner_id = user.id if user.role == UserRole.RESTAURANT_ADMIN else payload.owner_id
    validate_owner(db, owner_id)
    restaurant = Restaurant(**payload.model_dump(exclude={"owner_id"}), owner_id=owner_id)
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.put("/{restaurant_id}", response_model=RestaurantRead)
def update_restaurant(
    restaurant_id: int,
    payload: RestaurantUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> Restaurant:
    restaurant = ensure_restaurant_access(db, user, restaurant_id)
    updates = payload.model_dump(exclude_unset=True)
    if user.role != UserRole.SUPER_ADMIN:
        updates.pop("owner_id", None)
    elif "owner_id" in updates:
        validate_owner(db, updates["owner_id"])
    for key, value in updates.items():
        setattr(restaurant, key, value)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)),
) -> None:
    restaurant = ensure_restaurant_access(db, user, restaurant_id)
    restaurant.is_active = False
    db.commit()
