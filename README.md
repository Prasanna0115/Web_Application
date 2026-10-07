# FoodHub

FoodHub is a full-stack food-ordering starter with a React/Vite storefront and a FastAPI, SQLAlchemy, PostgreSQL backend. Customers can browse restaurants and menus, maintain a cart, place orders, and track status. Restaurant administrators and super administrators have role-scoped management dashboards and APIs.

## Project layout

- `frontend/` — React, Vite, React Router, Axios, and Bootstrap.
- `backend/app/` — FastAPI application, SQLAlchemy models, Pydantic schemas, routers, authentication, and services.
- `backend/alembic/` — versioned database migrations.
- `deployment/` — Nginx and systemd examples for an EC2 deployment.

## Local development

Requirements: Node.js 20+, Python 3.11+, PostgreSQL 14+.

1. Create a PostgreSQL database named `foodhub` and a least-privileged application database user.
2. Review `backend/.env`, set `DATABASE_URL` to your local PostgreSQL credentials, and keep its randomly generated `JWT_SECRET_KEY` private. For a new checkout, copy `backend/.env.example` to `backend/.env` and replace `JWT_SECRET_KEY` with a unique random secret (at least 32 random bytes). Do not commit `.env`.
3. From `backend/`, create/activate a virtual environment, install `requirements.txt`, then run:

   ```powershell
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

   The API is at `http://localhost:8000`; interactive API documentation is at `/docs`.
   For the backend integration tests, install `requirements-dev.txt` and run `python -m pytest`.
4. Review `frontend/.env`. For a new checkout, copy `frontend/.env.example` to `frontend/.env`, then set `VITE_API_BASE_URL` to `http://localhost:8000/api`.
5. From `frontend/`, install packages with `npm install` and start with `npm run dev`. Vite prints the local URL.

Public registration always creates a `CUSTOMER`. To create the first administrator, register an account, then promote it through a trusted database administration session:

```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'admin@example.com';
```

After signing in as a super administrator, assign restaurant ownership and promote additional restaurant administrators through the protected admin APIs or a trusted database session.

## API overview

All application routes use the `/api` prefix. Authentication uses `Authorization: Bearer <access_token>`.

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Restaurants: `GET/POST /restaurants`, `GET/PUT/DELETE /restaurants/{restaurant_id}`
- Categories: `GET /categories`, `GET /categories/{restaurant_id}`, `POST /categories`, `PUT/DELETE /categories/{category_id}`
- Menu: `GET /menu/{restaurant_id}`, `GET /menu/item/{item_id}`, `POST /menu`, `PUT/DELETE /menu/{item_id}`
- Cart: `GET/DELETE /cart`, `POST /cart/items`, `PUT/DELETE /cart/items/{cart_item_id}`
- Orders: `POST/GET /orders`, `GET /orders/{order_id}`, `PUT /orders/{order_id}/status`
- Administration: `GET /admin/users`, `PUT /admin/users/{user_id}`, `GET /admin/restaurants`, `GET /admin/orders`, `GET /admin/statistics`

Order totals and line prices are read from the database when ordering. Order items retain item-name and price snapshots so order history does not change when a menu is edited. Cart and order placement are limited to one restaurant at a time. Restaurant administrators can only manage restaurants they own. Customers can cancel their own orders only while `PLACED`; restaurant staff advance the lifecycle one step at a time.

Restaurants include an `owner_id` association in addition to the requested fields so restaurant-admin permissions can be restricted to restaurants assigned to that administrator.

## AWS deployment outline

See [`deployment/README.md`](deployment/README.md) for the EC2, RDS PostgreSQL, VPC, security-group, IAM, Nginx, and systemd deployment checklist. The provided Nginx host name and filesystem locations are examples and must be configured for the deployment.
