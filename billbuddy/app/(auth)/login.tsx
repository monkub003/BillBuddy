import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { Theme } from "@/constants/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error } = useAuth();

  const handleLogin = async () => {
    await login(email, password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>BillBuddy</Text>
        <Text style={styles.subtitle}>จัดการค่าใช้จ่ายอย่างชาญฉลาด</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="กรอกอีเมล"
          placeholderTextColor={Theme.text.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="อีเมล"
          editable={!loading}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="กรอกรหัสผ่าน"
          placeholderTextColor={Theme.text.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          accessibilityLabel="รหัสผ่าน"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="เข้าสู่ระบบ"
        >
          {loading ? (
            <ActivityIndicator color={Theme.text.primary} />
          ) : (
            <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity
            style={styles.linkContainer}
            accessibilityRole="link"
          >
            <Text style={styles.linkText}>
              ยังไม่มีบัญชี?{" "}
              <Text style={styles.linkHighlight}>สมัครสมาชิก</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Theme.text.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.text.secondary,
    textAlign: "center",
    marginBottom: 32,
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
    backgroundColor: Theme.background.card,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Theme.text.primary,
    fontWeight: "600",
    fontSize: 16,
  },
  error: {
    color: Theme.status.critical,
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
  linkContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  linkText: {
    color: Theme.text.secondary,
    fontSize: 14,
  },
  linkHighlight: {
    color: Theme.accent.green,
    fontWeight: "600",
  },
});
