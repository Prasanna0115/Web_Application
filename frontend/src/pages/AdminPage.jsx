import { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../context/AuthContext";

const statusNext = { PLACED: "CONFIRMED", CONFIRMED: "PREPARING", PREPARING: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DELIVERED" };
const emptyRestaurant = { name: "", description: "", address: "", city: "", phone: "", image_url: "" };

export default function AdminPage() {
  const { user } = useAuth();
  const superAdmin = user.role === "SUPER_ADMIN";
  const [tab, setTab] = useState("orders");
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurant);
  const [categoryName, setCategoryName] = useState("");
  const [menuForm, setMenuForm] = useState({ category_id: "", name: "", description: "", price: "", image_url: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedRestaurant = useMemo(() => restaurants.find((restaurant) => String(restaurant.id) === String(selectedId)), [restaurants, selectedId]);

  async function loadDashboard() {
    const [restaurantResult, orderResult] = await Promise.all([api.get("/admin/restaurants"), api.get("/admin/orders")]);
    setRestaurants(restaurantResult.data);
    setOrders(orderResult.data);
    if (superAdmin) {
      const [userResult, statsResult] = await Promise.all([api.get("/admin/users"), api.get("/admin/statistics")]);
      setUsers(userResult.data);
      setStatistics(statsResult.data);
    }
    if (!selectedId && restaurantResult.data.length) setSelectedId(String(restaurantResult.data[0].id));
  }

  useEffect(() => {
    loadDashboard().catch((reason) => setError(getErrorMessage(reason, "We couldn't load the dashboard.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setCategories([]);
      setMenu([]);
      return;
    }
    Promise.all([api.get(`/categories/${selectedId}`), api.get(`/menu/manage/${selectedId}`)])
      .then(([categoryResult, menuResult]) => {
        setCategories(categoryResult.data);
        setMenu(menuResult.data);
        setMenuForm((current) => ({ ...current, category_id: String(categoryResult.data[0]?.id || "") }));
      })
      .catch((reason) => setError(getErrorMessage(reason, "We couldn't load this restaurant's menu.")));
  }, [selectedId]);

  async function runAction(action, successMessage) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      setNotice(successMessage);
      await loadDashboard();
      if (selectedId) {
        const [categoryResult, menuResult] = await Promise.all([api.get(`/categories/${selectedId}`), api.get(`/menu/manage/${selectedId}`)]);
        setCategories(categoryResult.data);
        setMenu(menuResult.data);
      }
    } catch (reason) {
      setError(getErrorMessage(reason, "That change couldn't be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function createRestaurant(event) {
    event.preventDefault();
    await runAction(() => api.post("/restaurants", restaurantForm), "Restaurant added. Welcome to the neighborhood!");
    setRestaurantForm(emptyRestaurant);
  }

  async function saveRestaurant(event) {
    event.preventDefault();
    if (!selectedRestaurant) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.owner_id === "") data.owner_id = null;
    await runAction(() => api.put(`/restaurants/${selectedRestaurant.id}`, data), "Restaurant details saved.");
  }

  async function createCategory(event) {
    event.preventDefault();
    await runAction(() => api.post("/categories", { restaurant_id: Number(selectedId), name: categoryName }), "Category added.");
    setCategoryName("");
  }

  async function createMenuItem(event) {
    event.preventDefault();
    await runAction(() => api.post("/menu", { ...menuForm, restaurant_id: Number(selectedId), category_id: Number(menuForm.category_id), price: Number(menuForm.price) }), "Menu item added.");
    setMenuForm((current) => ({ ...current, name: "", description: "", price: "", image_url: "" }));
  }

  function advanceOrder(order) {
    const next = statusNext[order.status];
    if (next) runAction(() => api.put(`/orders/${order.id}/status`, { status: next }), `Order #${order.id} updated to ${next.replaceAll("_", " ").toLowerCase()}.`);
  }

  async function deactivateRestaurant(restaurant) {
    if (!window.confirm(`Pause ${restaurant.name}? Customers will no longer see it.`)) return;
    await runAction(() => api.delete(`/restaurants/${restaurant.id}`), `${restaurant.name} is now paused.`);
    if (String(restaurant.id) === selectedId) setSelectedId("");
  }

  async function deleteCategory(category) {
    await runAction(() => api.delete(`/categories/${category.id}`), `${category.name} removed.`);
  }

  async function updateCategory(category, name) {
    await runAction(() => api.put(`/categories/${category.id}`, { name }), "Category name saved.");
  }

  async function toggleMenuItem(item) {
    await runAction(() => api.put(`/menu/${item.id}`, { is_available: !item.is_available }), `${item.name} ${item.is_available ? "paused" : "available"} on the menu.`);
  }

  async function saveMenuItem(event, item) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runAction(() => api.put(`/menu/${item.id}`, { name: values.name, price: Number(values.price) }), `${item.name} updated.`);
  }

  async function deleteMenuItem(item) {
    await runAction(() => api.delete(`/menu/${item.id}`), `${item.name} removed from the menu.`);
  }

  async function updatePerson(person, updates) {
    await runAction(() => api.put(`/admin/users/${person.id}`, updates), `${person.name}'s account updated.`);
  }

  if (loading) return <main className="container page-section"><div className="loading-row"><span className="spinner-border spinner-border-sm text-brand" role="status" /> Getting your dashboard ready…</div></main>;

  return (
    <main className="container page-section admin-page">
      <div className="page-title-row admin-title"><div><span className="eyebrow text-uppercase">{superAdmin ? "The big picture" : "Your kitchen, your call"}</span><h1>{superAdmin ? "FoodHub, together." : "Welcome to your table."}</h1><p>{superAdmin ? "A little overview of all the good things happening." : "Keep an eye on orders and everything on your menu."}</p></div><span className="admin-role-pill">{superAdmin ? "Super administrator" : "Restaurant administrator"}</span></div>
      {error && <div className="alert alert-warning rounded-4">{error}</div>}
      {notice && <div className="alert alert-success rounded-4">{notice}</div>}

      {superAdmin && statistics && <section className="stats-grid">{[["People at the table", statistics.users], ["Local restaurants", statistics.restaurants], ["Orders so far", statistics.orders], ["Order value", `$${Number(statistics.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>}

      <div className="admin-tabs" role="tablist">{["orders", "restaurants", ...(superAdmin ? ["users"] : [])].map((name) => <button role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}{name === "orders" && orders.length > 0 && <span className="tab-count">{orders.length}</span>}</button>)}</div>

      {tab === "orders" && <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow text-uppercase">Fresh from the kitchen</span><h2>Incoming orders</h2></div></div>{orders.length ? <div className="admin-orders">{orders.map((order) => <article className="admin-order-card" key={order.id}><div className="admin-order-primary"><span className="admin-order-id">#{order.id}</span><span>{order.items.map((item) => `${item.quantity} × ${item.item_name}`).join(", ")}</span></div><div><span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span><small>{new Date(order.created_at).toLocaleString()}</small></div><strong>${Number(order.total_amount).toFixed(2)}</strong>{statusNext[order.status] ? <button className="btn btn-brand btn-sm rounded-pill px-3" disabled={busy} onClick={() => advanceOrder(order)}>Mark {statusNext[order.status].replaceAll("_", " ").toLowerCase()} →</button> : <span className="text-secondary small">{order.status === "DELIVERED" ? "All done" : "No action needed"}</span>}</article>)}</div> : <div className="admin-empty">No incoming orders yet. They’ll show up here as soon as they do.</div>}</section>}

      {tab === "restaurants" && <section className="admin-section">
        <div className="admin-section-heading"><div><span className="eyebrow text-uppercase">Keep the good stuff growing</span><h2>Your restaurants</h2></div></div>
        <form className="admin-form-card" onSubmit={createRestaurant}><h3>Add a restaurant</h3><div className="row g-3"><div className="col-md-6"><label>Restaurant name<input name="name" value={restaurantForm.name} onChange={(event) => setRestaurantForm({ ...restaurantForm, name: event.target.value })} required minLength="2" /></label></div><div className="col-md-6"><label>City<input name="city" value={restaurantForm.city} onChange={(event) => setRestaurantForm({ ...restaurantForm, city: event.target.value })} required minLength="2" /></label></div><div className="col-md-6"><label>Address<input name="address" value={restaurantForm.address} onChange={(event) => setRestaurantForm({ ...restaurantForm, address: event.target.value })} required minLength="3" /></label></div><div className="col-md-6"><label>Phone<input name="phone" value={restaurantForm.phone} onChange={(event) => setRestaurantForm({ ...restaurantForm, phone: event.target.value })} required /></label></div><div className="col-12"><label>A little about it <span className="optional-label">Optional</span><textarea name="description" value={restaurantForm.description} onChange={(event) => setRestaurantForm({ ...restaurantForm, description: event.target.value })} rows="2" /></label></div><div className="col-md-8"><label>Photo URL <span className="optional-label">Optional</span><input name="image_url" value={restaurantForm.image_url} onChange={(event) => setRestaurantForm({ ...restaurantForm, image_url: event.target.value })} /></label></div><div className="col-md-4 d-flex align-items-end"><button className="btn btn-brand rounded-pill px-4 w-100" disabled={busy}>Add restaurant</button></div></div></form>
        {restaurants.length > 0 && <div className="admin-manage-layout"><aside className="manage-restaurant-list">{restaurants.map((restaurant) => <button className={String(restaurant.id) === selectedId ? "selected" : ""} key={restaurant.id} onClick={() => setSelectedId(String(restaurant.id))}><span>{restaurant.name}</span><small>{restaurant.city}{!restaurant.is_active ? " · Paused" : ""}</small></button>)}</aside>
          {selectedRestaurant && <div className="manage-restaurant-content">
            <form className="admin-form-card compact" onSubmit={saveRestaurant}><div className="admin-subheading"><div><span className="eyebrow text-uppercase">The details</span><h3>{selectedRestaurant.name}</h3></div><button type="button" className="remove-link" onClick={() => deactivateRestaurant(selectedRestaurant)}>Pause restaurant</button></div><div className="row g-3"><div className="col-md-6"><label>Name<input name="name" defaultValue={selectedRestaurant.name} required /></label></div><div className="col-md-6"><label>City<input name="city" defaultValue={selectedRestaurant.city} required /></label></div><div className="col-md-6"><label>Address<input name="address" defaultValue={selectedRestaurant.address} required /></label></div><div className="col-md-6"><label>Phone<input name="phone" defaultValue={selectedRestaurant.phone} required /></label></div><div className="col-md-6"><label>Description<input name="description" defaultValue={selectedRestaurant.description || ""} /></label></div><div className="col-md-6"><label>Photo URL<input name="image_url" defaultValue={selectedRestaurant.image_url || ""} /></label></div>{superAdmin && <div className="col-md-6"><label>Restaurant administrator<select name="owner_id" defaultValue={selectedRestaurant.owner_id || ""}><option value="">No assigned administrator</option>{users.filter((person) => person.role === "RESTAURANT_ADMIN").map((person) => <option value={person.id} key={person.id}>{person.name} · {person.email}</option>)}</select></label></div>}<div className="col-12"><button className="btn btn-outline-dark rounded-pill px-4" disabled={busy}>Save details</button></div></div></form>
              <div className="admin-form-card compact"><div className="admin-subheading"><div><span className="eyebrow text-uppercase">Organize the menu</span><h3>Categories</h3></div></div><form className="inline-create-form" onSubmit={createCategory}><input aria-label="New category name" placeholder="e.g. Small plates" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required minLength="2" /><button className="btn btn-brand rounded-pill px-3" disabled={busy}>Add</button></form><div className="manage-list">{categories.map((category) => <form className="manage-list-row" key={category.id} onSubmit={(event) => { event.preventDefault(); updateCategory(category, new FormData(event.currentTarget).get("name")); }}><input name="name" aria-label={`${category.name} category name`} defaultValue={category.name} minLength="2" required /><button className="remove-link" disabled={busy}>Save</button><button type="button" className="remove-link" onClick={() => deleteCategory(category)}>Remove</button></form>)}{!categories.length && <p className="text-secondary small mb-0">Your first category is just a little name away.</p>}</div></div>
            <div className="admin-form-card compact"><div className="admin-subheading"><div><span className="eyebrow text-uppercase">Something delicious</span><h3>Menu items</h3></div></div><form onSubmit={createMenuItem}><div className="row g-3"><div className="col-md-6"><label>Name<input value={menuForm.name} onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })} required minLength="2" /></label></div><div className="col-md-6"><label>Category<select value={menuForm.category_id} onChange={(event) => setMenuForm({ ...menuForm, category_id: event.target.value })} required><option value="">Choose one</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><div className="col-md-4"><label>Price<input type="number" min="0.01" step="0.01" value={menuForm.price} onChange={(event) => setMenuForm({ ...menuForm, price: event.target.value })} required /></label></div><div className="col-md-8"><label>Photo URL <span className="optional-label">Optional</span><input value={menuForm.image_url} onChange={(event) => setMenuForm({ ...menuForm, image_url: event.target.value })} /></label></div><div className="col-12"><label>Description <span className="optional-label">Optional</span><textarea rows="2" value={menuForm.description} onChange={(event) => setMenuForm({ ...menuForm, description: event.target.value })} /></label></div><div className="col-12"><button className="btn btn-brand rounded-pill px-4" disabled={busy || !categories.length}>Add to menu</button>{!categories.length && <small className="text-secondary ms-2">Add a category first.</small>}</div></div></form>
              <div className="manage-list mt-4">{menu.map((item) => <div className="manage-list-row menu-manage-row" key={item.id}><form className="menu-manage-form" onSubmit={(event) => saveMenuItem(event, item)}><input name="name" aria-label={`${item.name} name`} defaultValue={item.name} minLength="2" required /><input name="price" aria-label={`${item.name} price`} type="number" min="0.01" step="0.01" defaultValue={Number(item.price).toFixed(2)} required /><button className="remove-link" disabled={busy}>Save</button></form><span className="d-flex gap-3"><button className="remove-link" onClick={() => toggleMenuItem(item)}>{item.is_available ? "Pause" : "Enable"}</button><button className="remove-link" onClick={() => deleteMenuItem(item)}>Remove</button></span></div>)}{!menu.length && <p className="text-secondary small mb-0">Add something lovely to the menu.</p>}</div>
            </div>
          </div>}
        </div>}
      </section>}

      {tab === "users" && superAdmin && <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow text-uppercase">Our community</span><h2>People at the table</h2></div></div><div className="table-responsive admin-table-wrap"><table className="table align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>State</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.email}</td><td><select className="form-select form-select-sm user-role-select" value={person.role} disabled={busy || person.id === user.id} onChange={(event) => updatePerson(person, { role: event.target.value })}><option value="CUSTOMER">Customer</option><option value="RESTAURANT_ADMIN">Restaurant admin</option><option value="SUPER_ADMIN">Super admin</option></select></td><td>{new Date(person.created_at).toLocaleDateString()}</td><td><button className="remove-link" disabled={busy || person.id === user.id} onClick={() => updatePerson(person, { is_active: !person.is_active })}>{person.is_active ? "Pause account" : "Activate account"}</button></td></tr>)}</tbody></table>{!users.length && <p className="text-secondary p-3">No accounts just yet.</p>}</div></section>}
    </main>
  );
}
