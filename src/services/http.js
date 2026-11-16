import axios from "axios";

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

const isApiRequest = (config) => {
  const url = config.baseURL ? `${config.baseURL}${config.url || ""}` : config.url || "";
  return url.startsWith(API_URL);
};

/**
 * Every request to the Strapi API carries the logged-in user's JWT (unless the
 * caller set its own Authorization header). If the API answers 401 while we sent
 * a token, the session has expired: clear it and go to the login page.
 */
export function attachAuth(instance) {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token && isApiRequest(config) && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    (error) => {
      const sentToken = String(error.config?.headers?.Authorization || "").startsWith("Bearer ");
      if (error.response?.status === 401 && sentToken && isApiRequest(error.config || {})) {
        ["token", "user", "role"].forEach((k) => localStorage.removeItem(k));
        if (window.location.pathname !== "/login") window.location.assign("/login");
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

// the global axios instance (used directly by several pages)
attachAuth(axios);

export const api = attachAuth(axios.create({ baseURL: `${API_URL}/api` }));
