import { View, ActivityIndicator, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { Theme } from "@/constants/theme";

export default function IndexScreen() {
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Theme.background.primary,
        }}
      >
        <Text
          style={{
            color: Theme.text.primary,
            fontSize: 28,
            fontWeight: "700",
            marginBottom: 24,
          }}
        >
          BillBuddy
        </Text>
        <ActivityIndicator size="large" color={Theme.accent.green} />
        <Text
          style={{
            color: Theme.text.secondary,
            fontSize: 14,
            marginTop: 16,
          }}
        >
          Loading...
        </Text>
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
