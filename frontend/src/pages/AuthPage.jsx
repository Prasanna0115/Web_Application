import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
      navigate(location.state?.from || "/", { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason, isRegister ? "We couldn't create your account." : "We couldn't sign you in."));
    } finally {
      setBusy(false);
    }
  }

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-art"><div className="auth-art-orbit">✦</div><span className="eyebrow text-white">A seat at the table</span><h2>There’s always<br />room for one more.</h2><p>Come hungry. Leave happy.</p><span className="auth-art-mark">foodhub · good things nearby</span></div>
        <div className="auth-form-wrap">
          <Link className="back-link" to="/">← Back to discovering</Link>
          <div className="auth-form-heading"><span className="eyebrow text-uppercase">{isRegister ? "Your next favorite is waiting" : "Good to have you back"}</span><h1>{isRegister ? "Come on in." : "Welcome back."}</h1><p>{isRegister ? "Create an account and let's find something delicious." : "Sign in to pick up right where you left off."}</p></div>
          {error && <div className="alert alert-warning rounded-4">{error}</div>}
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label>Your name<input name="name" autoComplete="name" value={form.name} onChange={update} required minLength="2" maxLength="120" /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required /></label>
            {isRegister && <label>Phone number <span className="optional-label">Optional</span><input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} /></label>}
            <label>Password<input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={update} required minLength={isRegister ? 8 : 1} /></label>
            <button className="btn btn-brand btn-lg rounded-pill w-100 mt-2" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create my account" : "Sign in"}</button>
          </form>
          <p className="auth-switch">{isRegister ? "Already part of the table?" : "New around here?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
        </div>
      </section>
    </main>
  );
}

