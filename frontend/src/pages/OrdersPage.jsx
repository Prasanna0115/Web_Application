import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../api";

const flow = ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
const labels = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Being prepared",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function StatusTrack({ status }) {
  if (status === "CANCELLED") return <div className="order-cancelled">This order was cancelled.</div>;
  const current = flow.indexOf(status);
  return <div className="status-track">{flow.map((step, index) => <div className={`status-step ${index <= current ? "complete" : ""} ${index === current ? "current" : ""}`} key={step}><span className="status-dot">{index < current ? "✓" : index + 1}</span><small>{labels[step]}</small></div>)}</div>;
}

function OrderCard({ order, featured = false, onCancel }) {
  return (
    <article className={`order-card ${featured ? "order-card-featured" : ""}`}>
      <div className="order-card-head"><div><span className="eyebrow text-uppercase">Order #{order.id}</span><p className="order-date mb-0">{new Date(order.created_at).toLocaleString()}</p></div><span className={`status-pill status-${order.status.toLowerCase()}`}>{labels[order.status]}</span></div>
      <StatusTrack status={order.status} />
      {order.status === "PLACED" && onCancel && <button className="remove-link mb-3" onClick={() => onCancel(order)}>Cancel this order</button>}
      <div className="order-items">{order.items.map((item) => <div className="order-item-row" key={item.id}><span>{item.quantity} × {item.item_name}</span><span>${Number(item.subtotal).toFixed(2)}</span></div>)}</div>
      <div className="order-total-row"><span>Total</span><strong>${Number(order.total_amount).toFixed(2)}</strong></div>
      <div className="order-delivery"><span>Delivering to</span><p>{order.delivery_address}</p></div>
    </article>
  );
}

export default function OrdersPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const request = orderId ? api.get(`/orders/${orderId}`).then(({ data }) => ({ selected: data })) : api.get("/orders").then(({ data }) => ({ orders: data }));
    request.then((data) => {
      if (!active) return;
      if (data.selected) setSelected(data.selected);
      else setOrders(data.orders);
    }).catch((reason) => { if (active) setError(getErrorMessage(reason, "We couldn't find that order.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  async function cancelOrder(order) {
    if (!window.confirm(`Cancel order #${order.id}?`)) return;
    setError("");
    setNotice("");
    try {
      const { data } = await api.put(`/orders/${order.id}/status`, { status: "CANCELLED" });
      if (orderId) setSelected(data);
      else setOrders((current) => current.map((entry) => entry.id === data.id ? data : entry));
      setNotice(`Order #${order.id} has been cancelled.`);
    } catch (reason) {
      setError(getErrorMessage(reason, "We couldn't cancel that order."));
    }
  }

  return (
    <main className="container page-section orders-page">
      <Link to="/" className="back-link">← Discover something delicious</Link>
      {orderId ? <>
        <div className="page-title-row"><div><span className="eyebrow text-uppercase">{location.state?.justPlaced ? "It’s official" : "Your order"}</span><h1>{location.state?.justPlaced ? "On its way." : "Order details."}</h1></div><Link to="/orders" className="text-link">All orders ↗</Link></div>
        {location.state?.justPlaced && <div className="order-success-banner"><span>✦</span><div><strong>Thanks for your order!</strong><small>The restaurant has been notified. You can follow its progress right here.</small></div></div>}
        {error && <div className="alert alert-warning rounded-4">{error}</div>}
        {notice && <div className="alert alert-success rounded-4">{notice}</div>}
        {loading ? <div className="loading-row"><span className="spinner-border spinner-border-sm text-brand" role="status" /> Finding your order…</div> : selected && <OrderCard order={selected} featured onCancel={cancelOrder} />}
      </> : <>
        <div className="page-title-row"><div><span className="eyebrow text-uppercase">A little taste of your favorites</span><h1>Your orders<span className="title-period">.</span></h1></div></div>
        {error && <div className="alert alert-warning rounded-4">{error}</div>}
        {notice && <div className="alert alert-success rounded-4">{notice}</div>}
        {loading ? <div className="loading-row"><span className="spinner-border spinner-border-sm text-brand" role="status" /> Gathering your orders…</div> :
          orders.length ? <div className="orders-list">{orders.map((order) => <OrderCard key={order.id} order={order} onCancel={cancelOrder} />)}</div> :
            <div className="empty-state"><div className="empty-illustration">♡</div><h2>Your next favorite is out there</h2><p>Your order history will show up here when you find it.</p><Link to="/" className="btn btn-brand rounded-pill px-4">Find something lovely</Link></div>}
      </>}
    </main>
  );
}
