import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const staff = user && user.role !== "CUSTOMER";

  function signOut() {
    logout();
    navigate("/");
  }

  return (
    <nav className="navbar navbar-expand-lg bg-white sticky-top border-bottom border-light-subtle py-2">
      <div className="container">
        <Link className="navbar-brand brand-mark" to="/" aria-label="FoodHub home">
          <span className="brand-icon">f</span> food<span>hub</span><span className="brand-caption">A GOOD THING, NEARBY</span>
        </Link>
        <button className="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="mainNav">
          <div className="navbar-nav mx-auto gap-lg-3">
            <NavLink className="nav-link" to="/" end>Discover</NavLink>
            {user && !staff && <NavLink className="nav-link" to="/orders">My orders</NavLink>}
            {staff && <NavLink className="nav-link" to="/admin">Dashboard</NavLink>}
          </div>
          <div className="d-flex align-items-center gap-3 mt-3 mt-lg-0">
            {user && !staff && <Link className="cart-link" to="/cart" aria-label="Open cart"><span aria-hidden="true">▤</span><span className="cart-link-label">Cart</span></Link>}
            {user ? (
              <>
                <span className="small text-secondary d-none d-sm-inline">Hi, {user.name.split(" ")[0]}</span>
                <button className="btn btn-outline-dark btn-sm rounded-pill px-3" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link className="nav-link sign-in-link" to="/login">Sign in</Link>
                <Link className="btn btn-brand btn-sm rounded-pill px-3" to="/register">Join FoodHub</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
