import { BrowserRouter, Route, Routes } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import CartPage from "./pages/CartPage";
import HomePage from "./pages/HomePage";
import OrdersPage from "./pages/OrdersPage";
import RestaurantPage from "./pages/RestaurantPage";

export default function App() {
  return <BrowserRouter><AuthProvider><div className="app-shell"><Navbar /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/restaurants/:restaurantId" element={<RestaurantPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route element={<ProtectedRoute roles={["CUSTOMER"]} />}>
      <Route path="/cart" element={<CartPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId" element={<OrdersPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={["RESTAURANT_ADMIN", "SUPER_ADMIN"]} />}>
      <Route path="/admin" element={<AdminPage />} />
    </Route>
    <Route path="*" element={<main className="container page-section empty-state"><div className="empty-illustration">✦</div><h1>Looks like this page took a detour.</h1><a className="btn btn-brand rounded-pill px-4" href="/">Back to FoodHub</a></main>} />
  </Routes><Footer /></div></AuthProvider></BrowserRouter>;
}

