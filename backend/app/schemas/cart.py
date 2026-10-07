from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.menu_item import MenuItemRead


class CartItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CartItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_item_id: int
    quantity: int
    menu_item: MenuItemRead


class CartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None
    items: list[CartItemRead]
    total_amount: Decimal
    updated_at: datetime | None

