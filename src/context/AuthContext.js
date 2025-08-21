import React, { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState(localStorage.getItem("role"));

  // Helper to sync localStorage
  const updateStorage = (key, value) => {
    if (value) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    else localStorage.removeItem(key);
  };

  useEffect(() => updateStorage("token", token), [token]);
  useEffect(() => updateStorage("user", user), [user]);
  useEffect(() => updateStorage("role", role), [role]);

  // ✅ Central logout handler
  const logout = () => {
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser, role, setRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Optional helper for role checking
export const isSuperUser = (role) => role === "Super Admin";
