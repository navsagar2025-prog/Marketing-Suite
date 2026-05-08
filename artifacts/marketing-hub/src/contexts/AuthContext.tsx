import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "staff";
  permissions: string[] | null;
}

export interface ImpersonationInfo {
  actorId: number;
  actorUsername: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  impersonation: ImpersonationInfo | null;
  login: (token: string, user: AuthUser, impersonation?: ImpersonationInfo | null) => void;
  logout: () => void;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "auth_token";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setImpersonation(null);
    setAuthTokenGetter(null);
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser, imp: ImpersonationInfo | null = null) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setImpersonation(imp);
    setAuthTokenGetter(() => Promise.resolve(newToken));
  }, []);

  const stopImpersonation = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    const res = await fetch(`${BASE}/api/auth/stop-impersonate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error("Failed to stop impersonation");
    const { token: newToken, user: newUser } = await res.json();
    login(newToken, newUser, null);
    window.location.href = `${BASE}/`;
  }, [login]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Not authenticated");
        const data = await r.json();
        setToken(storedToken);
        setUser(data.user);
        setImpersonation(data.impersonation ?? null);
        setAuthTokenGetter(() => Promise.resolve(storedToken));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, impersonation, login, logout, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = useCallback((module: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.permissions == null) return true;
    return user.permissions.includes(module);
  }, [user]);

  return { hasPermission, permissions: user?.permissions ?? null };
}
