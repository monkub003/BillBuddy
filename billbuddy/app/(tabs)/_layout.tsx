import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Theme.accent.green,
        tabBarInactiveTintColor: Theme.text.muted,
        tabBarStyle: {
          backgroundColor: Theme.background.tabBar,
          borderTopColor: "rgba(255,255,255,0.06)",
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "แดชบอร์ด",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📊</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "รายจ่าย",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📋</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "เพิ่ม",
          headerShown: false,
          tabBarIcon: () => (
            <View style={styles.addButton}>
              <Text style={styles.addIcon}>＋</Text>
            </View>
          ),
          tabBarLabel: () => (
            <Text style={styles.addLabel}>เพิ่ม</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: "แนวโน้ม",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📈</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "ตั้งค่า",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.accent.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 6,
    shadowColor: Theme.accent.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  addIcon: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  addLabel: {
    fontSize: 11,
    color: Theme.text.muted,
    marginTop: -4,
  },
});
