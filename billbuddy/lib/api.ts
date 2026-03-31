import { useAuthStore } from "@/store/authStore";
import { ApiResponse } from "@/types";
import { router } from "expo-router";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/";

function getBaseUrl(): string {
  return API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    router.replace("/(auth)/login");
    throw new Error("Session expired");
  }

  const body: ApiResponse<T> = await res.json();

  if (body.error) {
    throw new Error(body.error);
  }

  return body.data as T;
}
