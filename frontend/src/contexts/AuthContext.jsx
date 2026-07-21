// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { userAPI } from "../api/client"; // correct relative path to api client

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("doculex_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user:", e);
      }
    }

    async function tryLoadProfileFromToken() {
      const token = localStorage.getItem("doculex_token");
      if (!storedUser && token) {
        setIsLoading(true);
        try {
          const profile = await userAPI.getProfile();
          if (profile) {
            setUser(profile);
            localStorage.setItem("doculex_user", JSON.stringify(profile));
          } else {
            setUser({ tokenPresent: true });
          }
        } catch (err) {
          console.warn("Failed to fetch profile with token:", err);
          localStorage.removeItem("doculex_token");
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }

    tryLoadProfileFromToken();
  }, []);

  const login = (userData) => {
    // Accept either token string or { token, user } or full user object
    if (typeof userData === "string" || (userData && userData.token && !userData.user)) {
      const token = typeof userData === "string" ? userData : userData.token;
      try {
        localStorage.setItem("doculex_token", token);
      } catch (e) {
        console.warn("Failed to store token locally:", e);
      }

      // fetch profile async and update
      setIsLoading(true);
      userAPI
        .getProfile()
        .then((profile) => {
          if (profile) {
            setUser(profile);
            localStorage.setItem("doculex_user", JSON.stringify(profile));
          } else {
            setUser({ tokenPresent: true });
          }
        })
        .catch((err) => {
          console.warn("Failed to fetch profile after login:", err);
          localStorage.removeItem("doculex_token");
          setUser(null);
        })
        .finally(() => setIsLoading(false));

      return;
    }

    // If full user object provided
    setUser(userData);
    try {
      localStorage.setItem("doculex_user", JSON.stringify(userData));
    } catch (e) {
      console.warn("Failed to persist user:", e);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("doculex_user");
    localStorage.removeItem("doculex_token");
    // prefer SPA navigation; keep redirect only if needed
    window.location.href = "/login";
  };

  const updateUser = (updates = {}) => {
    const updatedUser = { ...(user || {}), ...updates };
    setUser(updatedUser);
    try {
      localStorage.setItem("doculex_user", JSON.stringify(updatedUser));
    } catch (e) {
      console.warn("Failed to persist updated user:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export { AuthContext };