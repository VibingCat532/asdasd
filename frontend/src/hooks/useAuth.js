import { useState, useEffect, useCallback, createContext, useContext } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      setStaffInfo(null);
      return null;
    }
  }, []);

  const fetchStaffInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/staff/me`, { withCredentials: true });
      setStaffInfo(res.data);
    } catch {
      setStaffInfo(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const u = await fetchUser();
      if (u) await fetchStaffInfo();
      setLoading(false);
    })();
  }, [fetchUser, fetchStaffInfo]);

  const login = () => {
    window.location.href = `${API}/auth/discord/start`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch {}
    setUser(null);
    setStaffInfo(null);
  };

  return (
    <AuthContext.Provider value={{ user, staffInfo, loading, login, logout, refetch: fetchUser, refetchStaff: fetchStaffInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
