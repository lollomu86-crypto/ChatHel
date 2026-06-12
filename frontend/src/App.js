import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import Landing from "./pages/Landing";
import GuestLogin from "./pages/GuestLogin";
import GuestApp from "./pages/GuestApp";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { getGuestToken, getAdminToken, getUserToken } from "./lib/api";

const GuestGuard = ({ children }) => ((getGuestToken() || getUserToken()) ? children : <Navigate to="/login" replace />);
const AdminGuard = ({ children }) => (getAdminToken() ? children : <Navigate to="/admin/login" replace />);

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestLogin />} />
          <Route path="/app/*" element={<GuestGuard><GuestApp /></GuestGuard>} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}
