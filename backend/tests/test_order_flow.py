from app.models.user import User, UserRole
from app.utils.security import hash_password


def test_customer_order_snapshots_prices_and_enforces_status_flow(client, test_session_factory):
    test_session_factory.add(User(
        name="Restaurant Admin",
        email="owner@example.com",
        password_hash=hash_password("strong-test-password"),
        role=UserRole.RESTAURANT_ADMIN,
    ))
    test_session_factory.commit()
    test_session_factory.close()

    registration = client.post(
        "/api/auth/register",
        json={"name": "Casey Customer", "email": "casey@example.com", "password": "customer-test-password"},
    )
    assert registration.status_code == 201
    assert registration.json()["role"] == "CUSTOMER"

    customer_token = client.post(
        "/api/auth/login",
        json={"email": "casey@example.com", "password": "customer-test-password"},
    ).json()["access_token"]
    admin_token = client.post(
        "/api/auth/login",
        json={"email": "owner@example.com", "password": "strong-test-password"},
    ).json()["access_token"]
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    restaurant = client.post(
        "/api/restaurants",
        headers=admin_headers,
        json={"name": "Test Kitchen", "address": "1 Main Street", "city": "Test City", "phone": "555-0100"},
    )
    assert restaurant.status_code == 201
    restaurant_id = restaurant.json()["id"]
    category = client.post(
        "/api/categories",
        headers=admin_headers,
        json={"restaurant_id": restaurant_id, "name": "Dinner"},
    )
    assert category.status_code == 201
    menu_item = client.post(
        "/api/menu",
        headers=admin_headers,
        json={
            "restaurant_id": restaurant_id,
            "category_id": category.json()["id"],
            "name": "Garden Bowl",
            "price": "6.50",
        },
    )
    assert menu_item.status_code == 201
    menu_item_id = menu_item.json()["id"]

    cart = client.post(
        "/api/cart/items",
        headers=customer_headers,
        json={"menu_item_id": menu_item_id, "quantity": 2},
    )
    assert cart.status_code == 201
    assert cart.json()["total_amount"] == "13.00"
    placed = client.post(
        "/api/orders",
        headers=customer_headers,
        json={"delivery_address": "2 Side Street, Test City", "phone": "555-0101"},
    )
    assert placed.status_code == 201
    order_id = placed.json()["id"]
    assert placed.json()["total_amount"] == "13.00"
    assert placed.json()["items"][0]["item_name"] == "Garden Bowl"
    assert placed.json()["items"][0]["price"] == "6.50"
    assert client.get("/api/cart", headers=customer_headers).json()["items"] == []

    forbidden_change = client.put(
        f"/api/orders/{order_id}/status",
        headers=customer_headers,
        json={"status": "CONFIRMED"},
    )
    assert forbidden_change.status_code == 403

    price_update = client.put(
        f"/api/menu/{menu_item_id}",
        headers=admin_headers,
        json={"price": "99.00"},
    )
    assert price_update.status_code == 200
    order_detail = client.get(f"/api/orders/{order_id}", headers=customer_headers)
    assert order_detail.json()["items"][0]["price"] == "6.50"
    assert order_detail.json()["total_amount"] == "13.00"

    for next_status in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"):
        response = client.put(
            f"/api/orders/{order_id}/status",
            headers=admin_headers,
            json={"status": next_status},
        )
        assert response.status_code == 200
        assert response.json()["status"] == next_status

    invalid_transition = client.put(
        f"/api/orders/{order_id}/status",
        headers=admin_headers,
        json={"status": "PREPARING"},
    )
    assert invalid_transition.status_code == 409


def test_customer_can_cancel_only_their_own_placed_order(client, test_session_factory):
    test_session_factory.add(User(
        name="Restaurant Admin",
        email="owner@example.com",
        password_hash=hash_password("strong-test-password"),
        role=UserRole.RESTAURANT_ADMIN,
    ))
    test_session_factory.commit()
    test_session_factory.close()
    client.post("/api/auth/register", json={
        "name": "Casey Customer", "email": "casey@example.com", "password": "customer-test-password",
    })
    customer_headers = {"Authorization": "Bearer " + client.post("/api/auth/login", json={
        "email": "casey@example.com", "password": "customer-test-password",
    }).json()["access_token"]}
    admin_headers = {"Authorization": "Bearer " + client.post("/api/auth/login", json={
        "email": "owner@example.com", "password": "strong-test-password",
    }).json()["access_token"]}
    restaurant_id = client.post("/api/restaurants", headers=admin_headers, json={
        "name": "Another Kitchen", "address": "1 Main Street", "city": "Test City", "phone": "555-0100",
    }).json()["id"]
    category_id = client.post("/api/categories", headers=admin_headers, json={
        "restaurant_id": restaurant_id, "name": "Dinner",
    }).json()["id"]
    item_id = client.post("/api/menu", headers=admin_headers, json={
        "restaurant_id": restaurant_id, "category_id": category_id, "name": "Soup", "price": "4.00",
    }).json()["id"]
    client.post("/api/cart/items", headers=customer_headers, json={"menu_item_id": item_id, "quantity": 1})
    order_id = client.post("/api/orders", headers=customer_headers, json={
        "delivery_address": "2 Side Street, Test City", "phone": "555-0101",
    }).json()["id"]
    response = client.put(f"/api/orders/{order_id}/status", headers=customer_headers, json={"status": "CANCELLED"})
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
