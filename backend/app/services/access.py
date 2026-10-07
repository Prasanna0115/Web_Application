from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.restaurant import Restaurant
from app.models.user import User, UserRole


def ensure_restaurant_access(db: Session, user: User, restaurant_id: int) -> Restaurant:
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if user.role == UserRole.SUPER_ADMIN or (
        user.role == UserRole.RESTAURANT_ADMIN and restaurant.owner_id == user.id
    ):
        return restaurant
    raise HTTPException(status_code=403, detail="You do not manage this restaurant")

