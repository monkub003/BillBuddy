import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);

  // Hydrate persisted JWT token on app start
  useEffect(() => {
    loadToken();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
