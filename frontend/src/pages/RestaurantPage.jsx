import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import MenuCard from "../components/MenuCard";
import { useAuth } from "../context/AuthContext";

export default function RestaurantPage() {
  const { restaurantId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [selected, setSelected] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/restaurants/${restaurantId}`), api.get(`/menu/${restaurantId}`), api.get(`/categories/${restaurantId}`)])
      .then(([restaurantResult, menuResult, categoryResult]) => {
        if (active) {
          setRestaurant(restaurantResult.data);
          setMenu(menuResult.data);
          setCategories(categoryResult.data);
        }
      })
      .catch((reason) => { if (active) setError(getErrorMessage(reason, "This restaurant isn't available right now.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restaurantId]);

  const [categories, setCategories] = useState([]);
  const sections = useMemo(() => categories, [categories]);
  const filteredMenu = selected === "All" ? menu : menu.filter((item) => String(item.category_id) === selected);

  async function addToCart(item) {
    if (!user) {
      navigate("/login", { state: { from: `/restaurants/${restaurantId}` } });
      return;
    }
    setBusy(item.id);
    setNotice("");
    setError("");
    try {
      await api.post("/cart/items", { menu_item_id: item.id, quantity: 1 });
      setNotice(`${item.name} was added to your cart.`);
    } catch (reason) {
      setError(getErrorMessage(reason, "We couldn't add that item."));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="page-loader"><span className="spinner-border text-brand" role="status" /></div>;
  if (error && !restaurant) return <main className="container page-section"><div className="alert alert-warning rounded-4">{error}</div><Link to="/" className="text-link">← Browse restaurants</Link></main>;

  return (
    <main className="container page-section">
      <Link to="/" className="back-link">← All restaurants</Link>
      <section className="restaurant-hero">
        <img src={restaurant.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85"} alt="" />
        <div className="restaurant-hero-shade" />
        <div className="restaurant-hero-copy"><span className="eyebrow text-white">A local favorite</span><h1>{restaurant.name}</h1><p>{restaurant.description || "Thoughtful food made with love, just around the corner."}</p><span>{restaurant.city} <span>·</span> Open for delivery</span></div>
      </section>
      <div className="menu-toolbar">
        <div><span className="eyebrow text-uppercase">Made for your appetite</span><h2>Explore the menu</h2></div>
        <Link className="btn btn-outline-dark rounded-pill px-4" to="/cart">View cart <span aria-hidden="true">↗</span></Link>
      </div>
      {notice && <div className="alert alert-success rounded-4">{notice} <Link to="/cart" className="alert-link">View cart</Link></div>}
      {error && <div className="alert alert-warning rounded-4">{error}</div>}
      {sections.length > 0 && <div className="menu-filters"><button className={selected === "All" ? "active" : ""} onClick={() => setSelected("All")}>Everything</button>{sections.map((section) => <button className={selected === String(section.id) ? "active" : ""} key={section.id} onClick={() => setSelected(String(section.id))}>{section.name}</button>)}</div>}
      {filteredMenu.length ? <div className="menu-grid">{filteredMenu.map((item) => <MenuCard key={item.id} item={item} onAdd={addToCart} busy={busy === item.id} />)}</div> :
        <div className="empty-state"><div className="empty-illustration">✦</div><h3>The menu is taking a little break</h3><p>Check back soon to see what’s cooking.</p></div>}
    </main>
  );
}
