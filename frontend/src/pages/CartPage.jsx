import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../context/AuthContext";

export default function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await api.get("/cart");
    setCart(data);
  }

  useEffect(() => {
    refresh()
      .catch((reason) => setError(getErrorMessage(reason, "We couldn't load your cart.")))
      .finally(() => setLoading(false));
  }, []);

  async function updateQuantity(itemId, quantity) {
    try {
      if (quantity === 0) await api.delete(`/cart/items/${itemId}`);
      else await api.put(`/cart/items/${itemId}`, { quantity });
      await refresh();
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  async function checkout(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/orders", { delivery_address: address, phone });
      navigate(`/orders/${data.id}`, { state: { justPlaced: true } });
    } catch (reason) {
      setError(getErrorMessage(reason, "We couldn't place your order."));
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="container page-section"><div className="loading-row"><span className="spinner-border spinner-border-sm text-brand" role="status" /> Opening your basket…</div></main>;
  if (!cart) return <main className="container page-section"><div className="alert alert-warning rounded-4">{error || "We couldn't load your cart."}</div><Link to="/" className="text-link">← Back to restaurants</Link></main>;

  return (
    <main className="container page-section">
      <Link to="/" className="back-link">← Keep discovering</Link>
      <div className="page-title-row"><div><span className="eyebrow text-uppercase">The good stuff</span><h1>Your cart<span className="title-period">.</span></h1></div><span className="item-count">{cart.items.length} {cart.items.length === 1 ? "item" : "items"}</span></div>
      {error && <div className="alert alert-warning rounded-4">{error}</div>}
      {!cart.items.length ? <div className="empty-state cart-empty"><div className="empty-illustration">♡</div><h2>A little room for something lovely</h2><p>Your cart is ready for its first favorite.</p><Link to="/" className="btn btn-brand rounded-pill px-4">Explore restaurants</Link></div> :
        <div className="row g-5 align-items-start">
          <section className="col-lg-7">
            <div className="cart-list">
              {cart.items.map((item) => <article className="cart-row" key={item.id}>
                <div className="cart-thumb">{item.menu_item.image_url ? <img src={item.menu_item.image_url} alt="" /> : <span aria-hidden="true">✦</span>}</div>
                <div className="cart-item-copy"><h2>{item.menu_item.name}</h2><p>${Number(item.menu_item.price).toFixed(2)} each</p><div className="quantity-control"><button aria-label={`Remove one ${item.menu_item.name}`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button aria-label={`Add one ${item.menu_item.name}`} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div></div>
                <div className="cart-line-total"><strong>${(Number(item.menu_item.price) * item.quantity).toFixed(2)}</strong><button className="remove-link" onClick={() => updateQuantity(item.id, 0)}>Remove</button></div>
              </article>)}
            </div>
            <Link to="/" className="text-link mt-4 d-inline-flex">← Add something else</Link>
          </section>
          <aside className="col-lg-5">
            <div className="checkout-card"><span className="eyebrow text-uppercase">Just a few details</span><h2>Delivery details</h2><form onSubmit={checkout}>
              <label>Delivery address<textarea value={address} onChange={(event) => setAddress(event.target.value)} required minLength="5" maxLength="500" placeholder="Street, apartment, city" rows="3" /></label>
              <label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required minLength="3" maxLength="30" /></label>
              <div className="checkout-total"><span>Subtotal</span><strong>${Number(cart.total_amount).toFixed(2)}</strong></div>
              <p className="checkout-footnote">Delivery fees are confirmed by the restaurant.</p>
              <button className="btn btn-brand btn-lg rounded-pill w-100" disabled={busy}>{busy ? "Placing your order…" : "Place order · $" + Number(cart.total_amount).toFixed(2)}</button>
            </form></div>
          </aside>
        </div>}
    </main>
  );
}
