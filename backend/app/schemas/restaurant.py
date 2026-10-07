from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RestaurantBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    address: str = Field(min_length=3, max_length=255)
    city: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=3, max_length=30)
    image_url: str | None = Field(default=None, max_length=500)


class RestaurantCreate(RestaurantBase):
    owner_id: int | None = None


class RestaurantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    address: str | None = Field(default=None, min_length=3, max_length=255)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=3, max_length=30)
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    owner_id: int | None = None


class RestaurantRead(RestaurantBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int | None
    is_active: bool
    created_at: datetime

