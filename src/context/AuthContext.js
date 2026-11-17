import React, { createContext, useCallback, useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

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

  const updateStorage = (key, value) => {
    if (value) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    else localStorage.removeItem(key);
  };

  useEffect(() => updateStorage("token", token), [token]);
  useEffect(() => updateStorage("user", user), [user]);
  useEffect(() => updateStorage("role", role), [role]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setRole(null);
  }, []);

  /** Store a JWT (from login or password reset) and load the user with their role. */
  const signIn = useCallback(async (jwt, user) => {
    localStorage.setItem("token", jwt); // PrivateRoute reads storage directly
    const { data: fullUser } = await axios.get(`${API_URL}/api/users/${user.id}?populate=role`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const roleName = fullUser.role?.name?.toLowerCase() || "authenticated";
    localStorage.setItem("user", JSON.stringify(fullUser));
    localStorage.setItem("role", roleName);
    setToken(jwt);
    setUser(fullUser);
    setRole(roleName);
    return fullUser;
  }, []);

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser, role, setRole, logout, signIn }}>
      {children}
    </AuthContext.Provider>
  );
};


export const isSuperUser = (role) => role === "Super Admin";
