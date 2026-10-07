import { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../api";
import RestaurantCard from "../components/RestaurantCard";

const categoryIcons = ["🍜", "🍕", "🥗", "🍔", "🍰", "🥐", "🍣", "🌮"];

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get("/restaurants", { params: city ? { city } : {} }),
      api.get("/categories"),
    ])
      .then(([restaurantResult, categoryResult]) => {
        if (active) {
          setRestaurants(restaurantResult.data);
          setCategories(categoryResult.data);
        }
      })
      .catch((reason) => { if (active) setError(getErrorMessage(reason, "We couldn't load restaurants right now.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [city]);

  const categoryNames = useMemo(() => [...new Map(categories.map((category) => [category.name.toLowerCase(), category.name])).values()].slice(0, 8), [categories]);
  const visibleRestaurants = useMemo(() => restaurants.filter((restaurant) =>
    (!selectedCategory || categories.some((category) => category.restaurant_id === restaurant.id && category.name.toLowerCase() === selectedCategory.toLowerCase()))
      && (restaurant.name.toLowerCase().includes(query.toLowerCase())
        || restaurant.city.toLowerCase().includes(query.toLowerCase()))), [restaurants, categories, query, selectedCategory]);

  return (
    <>
      <section className="hero-section">
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="hero-kicker-icon">✳</span> YOUR NEIGHBORHOOD, A LITTLE MORE DELICIOUS</span>
            <h1>Good food.<br /><span>Good mood.</span></h1>
            <p>Local favorites, lovely little discoveries, and the comfort food you’ve been thinking about.</p>
            <form className="hero-search" role="search" onSubmit={(event) => { event.preventDefault(); document.getElementById("restaurants")?.scrollIntoView({ behavior: "smooth" }); }}>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input aria-label="Search restaurants and cities" placeholder="A craving, a restaurant, a city…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="btn btn-brand rounded-pill px-4" type="submit">Find my food <span aria-hidden="true">↗</span></button>
            </form>
            <div className="hero-trust-row"><span><i>✓</i> Local spots</span><span><i>✓</i> Made to order</span><span><i>✓</i> Just for you</span></div>
          </div>
          <div className="hero-art">
            <div className="hero-art-orbit hero-art-orbit-one" />
            <div className="hero-art-orbit hero-art-orbit-two" />
            <div className="hero-image-frame"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=90" alt="A colorful meal ready to share" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1100&q=85"; }} /></div>
            <div className="hero-sticker"><span>GOOD FOOD</span><strong>made<br />local</strong><span>for you</span></div>
            <div className="hero-floating-card"><span className="floating-star">✳</span><span><strong>Your neighborhood table</strong><small>Find something worth savoring.</small></span><span className="floating-arrow">↗</span></div>
          </div>
        </div>
        <div className="hero-bottom container"><span>FIND YOUR NEXT FAVORITE</span><span className="hero-bottom-line" /><span>SUPPORT THE SPOTS YOU LOVE</span></div>
      </section>

      <section className="category-section container">
        <div className="section-heading">
          <div><span className="eyebrow text-uppercase">Follow the craving</span><h2>A taste for something?</h2><p className="section-subtitle mb-0">Pick a menu category and see what’s cooking nearby.</p></div>
          {selectedCategory && <button className="text-link clear-filter-button" onClick={() => setSelectedCategory("")}>Clear filter <span>×</span></button>}
        </div>
        <div className="category-list">
          {categoryNames.length ? categoryNames.map((label, index) => <button className={`category-chip category-chip-${index % 5} ${selectedCategory === label ? "selected" : ""}`} key={label} aria-pressed={selectedCategory === label} onClick={() => { setSelectedCategory((current) => current === label ? "" : label); document.getElementById("restaurants")?.scrollIntoView({ behavior: "smooth" }); }}><span>{categoryIcons[index % categoryIcons.length]}</span>{label}</button>) : <span className="category-empty">Restaurant categories will show up here.</span>}
        </div>
      </section>

      <section className="restaurants-section container" id="restaurants">
        <div className="section-heading align-items-end">
          <div><span className="eyebrow text-uppercase">A table is waiting</span><h2>{selectedCategory ? `${selectedCategory}, nearby` : "Meet your new favorites."}</h2><p className="section-subtitle mb-0">Good people. Good kitchens. Something delicious around the corner.</p></div>
          <label className="city-filter">Delivering to <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Any city" aria-label="Filter by city" /></label>
        </div>
        {error && <div className="alert alert-warning rounded-4">{error}</div>}
        {loading ? <div className="loading-row"><span className="spinner-border spinner-border-sm text-brand" role="status" /> Finding the good stuff…</div> :
          visibleRestaurants.length ? <div className="row g-4">{visibleRestaurants.map((restaurant) => <div className="col-sm-6 col-lg-4" key={restaurant.id}><RestaurantCard restaurant={restaurant} /></div>)}</div> :
            <div className="empty-state"><div className="empty-illustration">⌕</div><h3>No spots found just yet</h3><p>Try another search or city. We’re always finding new neighborhood favorites.</p></div>}
      </section>

      <section className="promise-band">
        <div className="container promise-inner">
          <div><span className="promise-icon">♡</span><span><strong>Local love</strong><small>Great food from good neighbors.</small></span></div>
          <div><span className="promise-icon">✳</span><span><strong>Made fresh</strong><small>Thoughtful, delicious, every time.</small></span></div>
          <div><span className="promise-icon">⌁</span><span><strong>Right on time</strong><small>From their kitchen to your door.</small></span></div>
        </div>
      </section>
    </>
  );
}
