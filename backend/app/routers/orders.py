from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus as ModelOrderStatus
from app.models.order_item import OrderItem
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate
from app.services.access import ensure_restaurant_access

router = APIRouter(prefix="/orders", tags=["orders"])

NEXT_STATUSES = {
    ModelOrderStatus.PLACED: {ModelOrderStatus.CONFIRMED, ModelOrderStatus.CANCELLED},
    ModelOrderStatus.CONFIRMED: {ModelOrderStatus.PREPARING},
    ModelOrderStatus.PREPARING: {ModelOrderStatus.OUT_FOR_DELIVERY},
    ModelOrderStatus.OUT_FOR_DELIVERY: {ModelOrderStatus.DELIVERED},
    ModelOrderStatus.DELIVERED: set(),
    ModelOrderStatus.CANCELLED: set(),
}


def order_query():
    return select(Order).options(selectinload(Order.items))


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
) -> Order:
    cart = db.scalar(
        select(Cart)
        .where(Cart.user_id == user.id)
        .with_for_update()
        .options(selectinload(Cart.items).selectinload(CartItem.menu_item))
    )
    if cart is None or not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")
    items = list(cart.items)
    if any(not item.menu_item.is_available for item in items):
        raise HTTPException(status_code=409, detail="One or more cart items are no longer available")
    restaurant_ids = {item.menu_item.restaurant_id for item in items}
    if len(restaurant_ids) != 1:
        raise HTTPException(status_code=409, detail="Your cart must contain items from one restaurant")
    restaurant_id = restaurant_ids.pop()
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(status_code=409, detail="This restaurant is not accepting orders")

    snapshots: list[tuple[str, int, Decimal, Decimal, int]] = []
    total = Decimal("0.00")
    for cart_item in items:
        menu_item = db.scalar(
            select(MenuItem).where(MenuItem.id == cart_item.menu_item_id).with_for_update()
        )
        if menu_item is None or not menu_item.is_available or menu_item.restaurant_id != restaurant_id:
            raise HTTPException(status_code=409, detail="One or more cart items are no longer available")
        price = menu_item.price
        subtotal = (price * cart_item.quantity).quantize(Decimal("0.01"))
        total += subtotal
        snapshots.append((menu_item.name, cart_item.quantity, price, subtotal, menu_item.id))

    order = Order(
        user_id=user.id,
        restaurant_id=restaurant_id,
        status=ModelOrderStatus.PLACED,
        total_amount=total,
        delivery_address=payload.delivery_address.strip(),
        phone=payload.phone.strip(),
    )
    db.add(order)
    db.flush()
    for item_name, quantity, price, subtotal, menu_item_id in snapshots:
        db.add(OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_id,
            item_name=item_name,
            quantity=quantity,
            price=price,
            subtotal=subtotal,
        ))
    db.delete(cart)
    db.commit()
    return db.scalar(order_query().where(Order.id == order.id))


@router.get("", response_model=list[OrderRead])
def list_orders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Order]:
    query = order_query().order_by(Order.created_at.desc())
    if user.role == UserRole.CUSTOMER:
        query = query.where(Order.user_id == user.id)
    elif user.role == UserRole.RESTAURANT_ADMIN:
        query = query.join(Restaurant).where(Restaurant.owner_id == user.id)
    return list(db.scalars(query))


@router.get("/{order_id}", response_model=OrderRead)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Order:
    order = db.scalar(order_query().where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.role == UserRole.CUSTOMER and order.user_id != user.id:
        raise HTTPException(status_code=403, detail="You cannot view this order")
    if user.role == UserRole.RESTAURANT_ADMIN:
        ensure_restaurant_access(db, user, order.restaurant_id)
    return order


@router.put("/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Order:
    order = db.scalar(order_query().where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    target = ModelOrderStatus(payload.status.value)
    if user.role == UserRole.CUSTOMER:
        if order.user_id != user.id or target != ModelOrderStatus.CANCELLED:
            raise HTTPException(status_code=403, detail="Customers may only cancel their own placed orders")
        if order.status != ModelOrderStatus.PLACED:
            raise HTTPException(status_code=409, detail="Only placed orders can be cancelled")
    elif user.role == UserRole.RESTAURANT_ADMIN:
        ensure_restaurant_access(db, user, order.restaurant_id)
        if target == ModelOrderStatus.CANCELLED:
            raise HTTPException(status_code=403, detail="Restaurant administrators cannot cancel orders")
    elif user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if target not in NEXT_STATUSES[order.status]:
        raise HTTPException(status_code=409, detail=f"Invalid order status transition: {order.status.value} to {target.value}")
    order.status = target
    db.commit()
    return db.scalar(order_query().where(Order.id == order.id))
