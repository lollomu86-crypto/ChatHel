import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const gt = localStorage.getItem("chathel_guest_token");
  const at = localStorage.getItem("chathel_admin_token");
  const ut = localStorage.getItem("chathel_user_token");
  const lng = localStorage.getItem("chathel_lng");
  if (gt) cfg.headers["X-Guest-Token"] = gt;
  if (at) cfg.headers["X-Admin-Token"] = at;
  if (ut) cfg.headers["Authorization"] = `Bearer ${ut}`;
  if (lng) cfg.headers["X-User-Lang"] = lng;
  return cfg;
});

export const setGuestToken = (t) => localStorage.setItem("chathel_guest_token", t);
export const clearGuestToken = () => localStorage.removeItem("chathel_guest_token");
export const getGuestToken = () => localStorage.getItem("chathel_guest_token");

export const setAdminToken = (t) => localStorage.setItem("chathel_admin_token", t);
export const clearAdminToken = () => localStorage.removeItem("chathel_admin_token");
export const getAdminToken = () => localStorage.getItem("chathel_admin_token");

export const setUserToken = (t) => localStorage.setItem("chathel_user_token", t);
export const clearUserToken = () => localStorage.removeItem("chathel_user_token");
export const getUserToken = () => localStorage.getItem("chathel_user_token");
