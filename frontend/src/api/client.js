import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({ baseURL });
export const refreshClient = axios.create({ baseURL });

export const tokenStorage = {
  get access() { return localStorage.getItem("access"); },
  get refresh() { return localStorage.getItem("refresh"); },
  set(tokens) {
    if (tokens.access) localStorage.setItem("access", tokens.access);
    if (tokens.refresh) localStorage.setItem("refresh", tokens.refresh);
  },
  clear() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  },
};

const forceLogout = () => {
  tokenStorage.clear();
  window.dispatchEvent(new Event("auth:logout"));
};

api.interceptors.request.use((config) => {
  const access = tokenStorage.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// un seul refresh pour plusieurs 401 simultanés
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes("/auth/token");
    if (error.response?.status !== 401 || !original || original._retry || isAuthCall) {
      return Promise.reject(error);
    }
    if (!tokenStorage.refresh) {
      forceLogout();
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      refreshPromise ??= refreshClient
        .post("/auth/token/refresh/", { refresh: tokenStorage.refresh })
        .then((r) => tokenStorage.set(r.data))
        .finally(() => { refreshPromise = null; });
      await refreshPromise;
      return api(original);
    } catch (e) {
      forceLogout();
      return Promise.reject(e);
    }
  }
);
