"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getApiErrorMessage } from "./api-client";
import { authStorage, type StoredUser } from "./auth-storage";

interface AuthContextValue {
  user: StoredUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<StoredUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setUser(authStorage.getUser());
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string) {
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      authStorage.setSession(data.accessToken, data.refreshToken, data.user);
      setUser(data.user);
      router.push("/painel");
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Credenciais inválidas"));
    }
  }

  function updateUser(patch: Partial<StoredUser>) {
    const current = authStorage.getUser();
    if (!current) return;
    const next = { ...current, ...patch };
    authStorage.setUser(next);
    setUser(next);
  }

  function logout() {
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      apiClient.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    authStorage.clear();
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
