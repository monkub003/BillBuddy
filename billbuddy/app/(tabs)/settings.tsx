import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useIncomeStore } from "@/store/incomeStore";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { Theme } from "@/constants/theme";
import { NotificationPreferences } from "@/types/notification";
import { router } from "expo-router";

export default function SettingsScreen() {
  const { monthlyIncome, setMonthlyIncome } = useIncomeStore();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  const [incomeInput, setIncomeInput] = useState(
    monthlyIncome ? String(monthlyIncome) : ""
  );
  const [saving, setSaving] = useState(false);

  // Notification preferences state
  const [billReminder, setBillReminder] = useState(true);
  const [budgetAlert, setBudgetAlert] = useState(true);
  const [trendWarning, setTrendWarning] = useState(true);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // Sync income input when store changes
  useEffect(() => {
    setIncomeInput(monthlyIncome ? String(monthlyIncome) : "");
  }, [monthlyIncome]);

  // Load notification preferences on mount
  useEffect(() => {
    loadNotificationPreferences();
  }, []);

  const loadNotificationPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const prefs = await apiClient<NotificationPreferences>(
        "/users/notification-preferences"
      );
      setBillReminder(prefs.billReminder.enabled);
      setBudgetAlert(prefs.budgetAlert.enabled);
      setTrendWarning(prefs.trendWarning.enabled);
    } catch {
      // Use defaults if fetch fails
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleSaveIncome = async () => {
    const value = parseFloat(incomeInput);
    if (isNaN(value) || value <= 0) {
      Alert.alert("ข้อมูลไม่ถูกต้อง", "กรุณากรอกจำนวนรายได้ที่ถูกต้อง");
      return;
    }

    setSaving(true);
    try {
      await apiClient("/users/income", {
        method: "PUT",
        body: JSON.stringify({ monthlyIncome: value }),
      });
      setMonthlyIncome(value);
      Alert.alert("บันทึกสำเร็จ", "อัปเดตรายได้ต่อเดือนแล้ว");
    } catch (err) {
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof Error ? err.message : "ไม่สามารถบันทึกรายได้ได้"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreference = async (
    key: "billReminder" | "budgetAlert" | "trendWarning",
    newValue: boolean
  ) => {
    // Optimistic update
    if (key === "billReminder") setBillReminder(newValue);
    if (key === "budgetAlert") setBudgetAlert(newValue);
    if (key === "trendWarning") setTrendWarning(newValue);

    try {
      const prefs: NotificationPreferences = {
        channels: ["push"],
        billReminder: {
          enabled: key === "billReminder" ? newValue : billReminder,
          daysBefore: 7,
        },
        budgetAlert: {
          enabled: key === "budgetAlert" ? newValue : budgetAlert,
          threshold: 0.8,
        },
        trendWarning: {
          enabled: key === "trendWarning" ? newValue : trendWarning,
        },
        yearlyExpenseReminder: { enabled: true, daysBefore: 30 },
      };
      await apiClient("/users/notification-preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
    } catch {
      // Revert on failure
      if (key === "billReminder") setBillReminder(!newValue);
      if (key === "budgetAlert") setBudgetAlert(!newValue);
      if (key === "trendWarning") setTrendWarning(!newValue);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "ลบบัญชี",
      "คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี? ข้อมูลทั้งหมดจะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบบัญชี",
          style: "destructive",
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      await apiClient("/users/account", { method: "DELETE" });
      logout();
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof Error ? err.message : "ไม่สามารถลบบัญชีได้"
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>ตั้งค่า</Text>

        {/* Section 1: รายได้ */}
        <Text style={styles.sectionTitle}>รายได้</Text>
        <View style={styles.card}>
          <Text style={styles.label}>รายได้ต่อเดือน (บาท)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="กรอกรายได้ต่อเดือน"
            placeholderTextColor={Theme.text.muted}
            value={incomeInput}
            onChangeText={setIncomeInput}
          />
          {monthlyIncome != null && monthlyIncome > 0 && (
            <Text style={styles.currentValue}>
              ปัจจุบัน: ฿{monthlyIncome.toLocaleString()}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleSaveIncome}
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "กำลังบันทึก..." : "บันทึกรายได้"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: การแจ้งเตือน */}
        <Text style={styles.sectionTitle}>การแจ้งเตือน</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>แจ้งเตือนบิลครบกำหนด</Text>
              <Text style={styles.toggleDescription}>
                แจ้งเตือน 7 วันก่อนครบกำหนดชำระ
              </Text>
            </View>
            <Switch
              value={billReminder}
              onValueChange={(v) => handleTogglePreference("billReminder", v)}
              trackColor={{
                false: Theme.text.muted,
                true: Theme.accent.green,
              }}
              thumbColor={Theme.text.primary}
              disabled={loadingPrefs}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>แจ้งเตือนงบประมาณ</Text>
              <Text style={styles.toggleDescription}>
                แจ้งเตือนเมื่อใช้จ่ายเกิน 80% ของงบ
              </Text>
            </View>
            <Switch
              value={budgetAlert}
              onValueChange={(v) => handleTogglePreference("budgetAlert", v)}
              trackColor={{
                false: Theme.text.muted,
                true: Theme.accent.green,
              }}
              thumbColor={Theme.text.primary}
              disabled={loadingPrefs}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>แจ้งเตือนแนวโน้มค่าใช้จ่าย</Text>
              <Text style={styles.toggleDescription}>
                แจ้งเตือนเมื่อค่าใช้จ่ายมีแนวโน้มเพิ่มขึ้น
              </Text>
            </View>
            <Switch
              value={trendWarning}
              onValueChange={(v) => handleTogglePreference("trendWarning", v)}
              trackColor={{
                false: Theme.text.muted,
                true: Theme.accent.green,
              }}
              thumbColor={Theme.text.primary}
              disabled={loadingPrefs}
            />
          </View>
        </View>

        {/* Section 3: บัญชี */}
        <Text style={styles.sectionTitle}>บัญชี</Text>
        <View style={styles.card}>
          <Text style={styles.label}>อีเมล</Text>
          <Text style={styles.emailText}>{user?.email ?? "-"}</Text>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>ลบบัญชี</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.text.secondary,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.text.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.text.muted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Theme.text.primary,
    backgroundColor: Theme.background.primary,
  },
  currentValue: {
    fontSize: 12,
    color: Theme.text.muted,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Theme.text.primary,
    fontWeight: "600",
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Theme.text.primary,
  },
  toggleDescription: {
    fontSize: 12,
    color: Theme.text.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.text.muted,
    opacity: 0.2,
    marginVertical: 8,
  },
  emailText: {
    fontSize: 16,
    color: Theme.text.primary,
    marginBottom: 8,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: Theme.text.muted,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonText: {
    color: Theme.text.primary,
    fontWeight: "600",
    fontSize: 16,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: Theme.status.critical,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  deleteButtonText: {
    color: Theme.status.critical,
    fontWeight: "600",
    fontSize: 16,
  },
});
