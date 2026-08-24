import React, { createContext, useContext, useState, useEffect } from "react";
import type { Stalker } from "@/lib/schemas";

interface AuthContextType {
  stalker: Stalker | null;
  token: string | null;
  isLoading: boolean;
  login: (s: Stalker) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "deercull_stalker";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stalker, setStalker] = useState<Stalker | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Stalker;
        setStalker(parsed);
        setToken(parsed.token ?? null);
      }
    } catch (e) {
      console.error("Failed to parse stored stalker", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (s: Stalker) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setStalker(s);
    setToken(s.token ?? null);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStalker(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ stalker, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Stalker;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}
