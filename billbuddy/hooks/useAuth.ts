import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";
import { User } from "@/types";

interface AuthResponse {
  token: string;
  user: User;
}

export function useAuth() {
  const { setAuth, logout: storeLogout, token, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAuth(data.token, data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setLoading(false);
      }
    },
    [setAuth]
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<AuthResponse>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAuth(data.token, data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Signup failed");
      } finally {
        setLoading(false);
      }
    },
    [setAuth]
  );

  const logout = useCallback(() => {
    storeLogout();
  }, [storeLogout]);

  return { login, signup, logout, loading, error, token, user };
}
