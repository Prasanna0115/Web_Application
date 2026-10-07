import { Link } from "react-router-dom";

const fallbackImage = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85";

export default function RestaurantCard({ restaurant }) {
  return (
    <Link className="restaurant-card card h-100 text-decoration-none" to={`/restaurants/${restaurant.id}`}>
      <div className="restaurant-image-wrap">
        <img className="restaurant-image" src={restaurant.image_url || fallbackImage} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} />
        <span className="restaurant-image-label"><span /> GOOD FOOD, RIGHT AROUND THE CORNER</span>
        <span className="restaurant-image-arrow" aria-hidden="true">↗</span>
      </div>
      <div className="card-body px-0 pb-0">
        <div className="restaurant-card-heading"><div><h3 className="restaurant-name">{restaurant.name}</h3><p className="restaurant-meta mb-0"><span className="restaurant-location-icon" aria-hidden="true">⌖</span>{restaurant.city}</p></div><span className="restaurant-card-arrow" aria-hidden="true">↗</span></div>
      </div>
    </Link>
  );
}
