import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function RootLayout() {
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const loadToken = useAuthStore((s) => s.loadToken);
  const segments = useSegments();
  const router = useRouter();

  // Hydrate persisted JWT token on app start
  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    // Wait for token hydration before redirecting
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (token && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [token, segments, loading]);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
