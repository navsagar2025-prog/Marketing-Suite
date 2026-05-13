import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "@seo_command_token";
const USER_KEY = "@seo_command_user";

interface User {
  id: number;
  username: string;
  role: string;
  plan?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Module-level token so setAuthTokenGetter can read it synchronously
let _currentToken: string | null = null;
export function getCurrentToken(): string | null {
  return _currentToken;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken) {
          _currentToken = storedToken;
          setToken(storedToken);
        }
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // silently ignore storage errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({ error: "Login failed" }));
    if (!res.ok) {
      throw new Error(body?.error ?? "Login failed");
    }
    _currentToken = body.token;
    setToken(body.token);
    setUser(body.user);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, body.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(body.user)),
    ]);
  };

  const logout = async () => {
    _currentToken = null;
    setToken(null);
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
