from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.menu_item import MenuItem
from app.models.user import User, UserRole
from app.schemas.cart import CartItemCreate, CartItemRead, CartItemUpdate, CartRead

router = APIRouter(prefix="/cart", tags=["cart"])


def load_cart(db: Session, user_id: int, *, lock: bool = False) -> Cart | None:
    query = (
        select(Cart)
        .where(Cart.user_id == user_id)
        .options(selectinload(Cart.items).selectinload(CartItem.menu_item))
    )
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def to_cart_read(cart: Cart | None) -> CartRead:
    items = [] if cart is None else [CartItemRead.model_validate(item) for item in cart.items]
    total = sum((item.menu_item.price * item.quantity for item in items), Decimal("0.00"))
    return CartRead(id=None if cart is None else cart.id, items=items, total_amount=total,
                    updated_at=None if cart is None else cart.updated_at)


@router.get("", response_model=CartRead)
def get_cart(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> CartRead:
    return to_cart_read(load_cart(db, user.id))


@router.post("/items", response_model=CartRead, status_code=status.HTTP_201_CREATED)
def add_cart_item(
    payload: CartItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> CartRead:
    menu_item = db.get(MenuItem, payload.menu_item_id)
    if menu_item is None or not menu_item.is_available:
        raise HTTPException(status_code=404, detail="Available menu item not found")
    cart = load_cart(db, user.id, lock=True)
    if cart is None:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.flush()
    if any(item.menu_item.restaurant_id != menu_item.restaurant_id for item in cart.items):
        raise HTTPException(status_code=409, detail="A cart can contain items from only one restaurant")
    existing = next((item for item in cart.items if item.menu_item_id == menu_item.id), None)
    if existing:
        if existing.quantity + payload.quantity > 99:
            raise HTTPException(status_code=422, detail="Cart item quantity cannot exceed 99")
        existing.quantity += payload.quantity
    else:
        cart.items.append(CartItem(menu_item_id=menu_item.id, quantity=payload.quantity))
    db.commit()
    return to_cart_read(load_cart(db, user.id))


@router.put("/items/{cart_item_id}", response_model=CartRead)
def update_cart_item(
    cart_item_id: int,
    payload: CartItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> CartRead:
    item = db.scalar(
        select(CartItem).join(Cart).where(CartItem.id == cart_item_id, Cart.user_id == user.id).with_for_update()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")
    item.quantity = payload.quantity
    db.commit()
    return to_cart_read(load_cart(db, user.id))


@router.delete("/items/{cart_item_id}", response_model=CartRead)
def remove_cart_item(
    cart_item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> CartRead:
    item = db.scalar(
        select(CartItem).join(Cart).where(CartItem.id == cart_item_id, Cart.user_id == user.id).with_for_update()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    return to_cart_read(load_cart(db, user.id))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> None:
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id).with_for_update())
    if cart is not None:
        db.delete(cart)
        db.commit()
