import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { Theme } from "@/constants/theme";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { signup, loading, error } = useAuth();

  const handleSignup = async () => {
    setValidationError(null);

    if (!EMAIL_REGEX.test(email)) {
      setValidationError("กรุณากรอกอีเมลที่ถูกต้อง");
      return;
    }

    if (password.length < 8) {
      setValidationError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    await signup(email, password);
  };

  const displayError = validationError ?? error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>สร้างบัญชี</Text>
          <Text style={styles.subtitle}>เริ่มต้นจัดการค่าใช้จ่ายกับ BillBuddy</Text>

          {displayError ? (
            <Text style={styles.error}>{displayError}</Text>
          ) : null}

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
            placeholder="อย่างน้อย 8 ตัวอักษร"
            placeholderTextColor={Theme.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel="รหัสผ่าน"
            editable={!loading}
          />

          <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            placeholderTextColor={Theme.text.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            accessibilityLabel="ยืนยันรหัสผ่าน"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="สมัครสมาชิก"
          >
            {loading ? (
              <ActivityIndicator color={Theme.text.primary} />
            ) : (
              <Text style={styles.buttonText}>สมัครสมาชิก</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity
              style={styles.linkContainer}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>
                มีบัญชีอยู่แล้ว?{" "}
                <Text style={styles.linkHighlight}>เข้าสู่ระบบ</Text>
              </Text>
            </TouchableOpacity>
          </Link>
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
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontSize: 28,
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
