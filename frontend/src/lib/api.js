import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const gt = localStorage.getItem("chathel_guest_token");
  const at = localStorage.getItem("chathel_admin_token");
  if (gt) cfg.headers["X-Guest-Token"] = gt;
  if (at) cfg.headers["X-Admin-Token"] = at;
  return cfg;
});

export const setGuestToken = (t) => localStorage.setItem("chathel_guest_token", t);
export const clearGuestToken = () => localStorage.removeItem("chathel_guest_token");
export const getGuestToken = () => localStorage.getItem("chathel_guest_token");

export const setAdminToken = (t) => localStorage.setItem("chathel_admin_token", t);
export const clearAdminToken = () => localStorage.removeItem("chathel_admin_token");
export const getAdminToken = () => localStorage.getItem("chathel_admin_token");
