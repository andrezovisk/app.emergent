import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "super_admin" | "company" | "customer";
export type User = {
  id: string;
  email: string;
  role: Role;
  name?: string;
  phone?: string;
  company_id?: string | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  registerCustomer: (email: string, password: string, name: string, phone?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) {
        setUser(null);
        return;
      }
      const u = await api<User>("/auth/me");
      setUser(u);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const registerCustomer = async (email: string, password: string, name: string, phone?: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/register-customer", {
      method: "POST",
      body: JSON.stringify({ email, password, name, phone }),
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, registerCustomer, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
