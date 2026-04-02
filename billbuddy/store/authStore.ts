import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User } from "@/types";
import { apiClient } from "@/lib/api";

const TOKEN_KEY = "billbuddy_jwt";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;

  /** Set token + user after login/signup, persists token to SecureStore */
  setAuth: (token: string, user: User) => void;

  /** Store JWT token and persist to SecureStore */
  setToken: (token: string) => void;

  /** Clear JWT token from state and SecureStore */
  clearToken: () => void;

  /** Load persisted token from SecureStore on app start */
  loadToken: () => Promise<void>;

  /** Fetch current user profile from API using stored token */
  refreshUser: () => Promise<void>;

  /** Clear all auth state and persisted token */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: false,

  setAuth: (token, user) => {
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    set({ token, user });
  },

  setToken: (token) => {
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    set({ token });
  },

  clearToken: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    set({ token: null });
  },

  loadToken: async () => {
    set({ loading: true });
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        set({ token });
        // Attempt to fetch user profile with the restored token
        await get().refreshUser();
      }
    } catch {
      // Token not found or corrupted — stay logged out
    } finally {
      set({ loading: false });
    }
  },

  refreshUser: async () => {
    try {
      const user = await apiClient<User>("/users/me");
      set({ user });
    } catch {
      // Token invalid or expired — clear auth state
      get().logout();
    }
  },

  logout: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    set({ token: null, user: null });
  },
}));
