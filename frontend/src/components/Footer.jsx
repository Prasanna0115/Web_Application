import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <Link className="brand-mark text-white" to="/"><span className="brand-icon">f</span> food<span>hub</span></Link>
        <p className="mb-0 small">Good food brings us together. © {new Date().getFullYear()} FoodHub.</p>
        <a className="small text-white text-decoration-none" href="mailto:hello@foodhub.example">Need a hand? Get in touch</a>
      </div>
    </footer>
  );
}

