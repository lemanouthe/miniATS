import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({ baseURL });
// Client séparé, sans intercepteurs : un refresh qui échoue ne doit pas relancer un refresh.
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

// Une seule promesse de refresh partagée : si plusieurs requêtes reçoivent un 401
// en même temps, elles attendent toutes le même refresh au lieu d'en lancer un chacune.
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
        // Stocke aussi le refresh s'il est renvoyé (ROTATE_REFRESH_TOKENS activé).
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
