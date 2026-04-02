import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useExpenses } from "@/hooks/useExpenses";
import { useExtraction } from "@/hooks/useExtraction";
import { ExtractionReview } from "@/components/forms/ExtractionReview";
import { ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

// ─── Types ──────────────────────────────────────────────────

type InputMode = "manual" | "camera" | "email";

interface CategoryOption {
  value: ExpenseCategory;
  label: string;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: "electricity", label: "สาธารณูปโภค", color: Theme.chart.electricity },
  { value: "food", label: "อาหาร", color: Theme.status.critical },
  { value: "transport", label: "การเดินทาง", color: Theme.chart.water },
  { value: "household", label: "ของใช้ในบ้าน", color: Theme.status.healthy },
  { value: "entertainment", label: "บันเทิง", color: Theme.chart.manual },
  { value: "health", label: "สุขภาพ", color: Theme.status.critical },
  { value: "education", label: "การศึกษา", color: Theme.chart.water },
  { value: "manual", label: "อื่นๆ", color: Theme.text.muted },
];

const INPUT_MODES: { value: InputMode; label: string; icon: string }[] = [
  { value: "manual", label: "กรอกเอง", icon: "✏️" },
  { value: "camera", label: "ถ่ายรูปบิล", icon: "📷" },
  { value: "email", label: "อีเมลบิล", icon: "✉️" },
];

// ─── Helpers ────────────────────────────────────────────────

function todayFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

function parseDisplayDate(display: string): string {
  const parts = display.replace(/\s/g, "").split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return new Date().toISOString().slice(0, 10);
}

// ─── Main Screen ────────────────────────────────────────────

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { createExpense, loading } = useExpenses();
  const extraction = useExtraction();

  const [mode, setMode] = useState<InputMode>("manual");
  const [amount, setAmount] = useState("0.00");
  const [description, setDescription] = useState("");
  const [dateDisplay, setDateDisplay] = useState(todayFormatted());
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์กล้อง", "กรุณาอนุญาตเข้าถึงกล้องในการตั้งค่า");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleExtract = async () => {
    if (!previewUri) return;
    const result = await extraction.extractFromImage(previewUri);
    if (result) {
      setShowReview(true);
    }
  };

  const handleReviewDone = () => {
    setShowReview(false);
    setPreviewUri(null);
    extraction.reset();
  };

  const handleSubmit = async () => {
    setValidationError(null);

    if (mode === "camera") {
      if (!previewUri) {
        Alert.alert("เลือกรูป", "กรุณาถ่ายรูปหรือเลือกรูปจากคลังภาพก่อน");
        return;
      }
      await handleExtract();
      return;
    }
    if (mode === "email") {
      Alert.alert("อีเมลบิล", "ฟีเจอร์นำเข้าจากอีเมลจะเชื่อมต่อกับบัญชีอีเมลของคุณ");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError("จำนวนเงินต้องมากกว่า 0");
      return;
    }

    const cat = CATEGORIES[selectedCategory];
    const result = await createExpense({
      category: cat.value,
      amount: numAmount,
      dueDate: parseDisplayDate(dateDisplay),
      isPaid: false,
      extractedVia: "manual",
    });

    if (result) {
      Alert.alert("สำเร็จ", "บันทึกค่าใช้จ่ายเรียบร้อย", [
        {
          text: "ตกลง",
          onPress: () => {
            setAmount("0.00");
            setDescription("");
            setDateDisplay(todayFormatted());
            setSelectedCategory(0);
            router.navigate("/(tabs)");
          },
        },
      ]);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Page title */}
      <Text style={styles.pageTitle}>เพิ่มค่าใช้จ่าย</Text>

      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        {INPUT_MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.modeTab, mode === m.value && styles.modeTabActive]}
            onPress={() => setMode(m.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m.value }}
            accessibilityLabel={m.label}
          >
            <Text style={styles.modeIcon}>{m.icon}</Text>
            <Text
              style={[
                styles.modeLabel,
                mode === m.value && styles.modeLabelActive,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Manual form */}
      {mode === "manual" && (
        <>
          {/* Amount */}
          <Text style={styles.fieldLabel}>จำนวนเงิน (บาท)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              onFocus={() => { if (amount === "0.00") setAmount(""); }}
              onBlur={() => { if (amount === "") setAmount("0.00"); }}
              placeholderTextColor={Theme.text.muted}
              placeholder="0.00"
              accessibilityLabel="จำนวนเงิน"
            />
          </View>

          {/* Description */}
          <Text style={styles.fieldLabel}>รายละเอียด</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={Theme.text.muted}
              placeholder="เช่น ค่าไฟฟ้า เดือน มี.ค."
              accessibilityLabel="รายละเอียด"
            />
          </View>

          {/* Date */}
          <Text style={styles.fieldLabel}>วันที่</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={dateDisplay}
              onChangeText={setDateDisplay}
              placeholderTextColor={Theme.text.muted}
              placeholder="DD / MM / YYYY"
              accessibilityLabel="วันที่"
            />
            <Text style={styles.calendarIcon}>📅</Text>
          </View>

          {/* Category grid */}
          <Text style={styles.fieldLabel}>หมวดหมู่</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={`${cat.value}-${idx}`}
                style={[
                  styles.categoryItem,
                  selectedCategory === idx && styles.categoryItemActive,
                ]}
                onPress={() => setSelectedCategory(idx)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedCategory === idx }}
                accessibilityLabel={cat.label}
              >
                <View
                  style={[styles.categoryDot, { backgroundColor: cat.color }]}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === idx && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {validationError && (
            <Text style={styles.errorText}>{validationError}</Text>
          )}
        </>
      )}

      {/* Camera — image picker + extraction */}
      {mode === "camera" && (
        <>
          {showReview && extraction.result ? (
            <ExtractionReview
              extraction={extraction.result}
              sourceRef=""
              extractedVia="image"
              onConfirm={handleReviewDone}
              onCancel={() => { setShowReview(false); extraction.reset(); }}
            />
          ) : extraction.loading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator size="large" color={Theme.accent.green} />
              <Text style={[styles.placeholderText, { marginTop: 12 }]}>
                กำลังสกัดข้อมูลด้วย AI...
              </Text>
            </View>
          ) : (
            <View style={styles.placeholder}>
              {previewUri ? (
                <>
                  <Image
                    source={{ uri: previewUri }}
                    style={{ width: 200, height: 260, borderRadius: 12, marginBottom: 16 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={{ marginBottom: 12 }}
                    onPress={() => setPreviewUri(null)}
                  >
                    <Text style={{ color: Theme.text.secondary, fontSize: 14 }}>เปลี่ยนรูป</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={styles.placeholderText}>
                    ถ่ายรูปหรือเลือกรูปใบเสร็จเพื่อให้ AI สกัดข้อมูล
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                    <TouchableOpacity
                      style={[styles.submitButton, { flex: 1, backgroundColor: Theme.background.card }]}
                      onPress={handleTakePhoto}
                    >
                      <Text style={[styles.submitText, { color: Theme.text.primary }]}>📷 ถ่ายรูป</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitButton, { flex: 1, backgroundColor: Theme.background.card }]}
                      onPress={handlePickImage}
                    >
                      <Text style={[styles.submitText, { color: Theme.text.primary }]}>🖼️ คลังภาพ</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {extraction.error && (
                <Text style={[styles.errorText, { marginTop: 12 }]}>{extraction.error}</Text>
              )}
            </View>
          )}
        </>
      )}

      {/* Email placeholder */}
      {mode === "email" && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>✉️</Text>
          <Text style={styles.placeholderText}>
            เชื่อมต่ออีเมลเพื่อนำเข้าใบเสร็จอัตโนมัติ
          </Text>
        </View>
      )}

      {/* Submit button — hide during extraction review */}
      {!(mode === "camera" && showReview) && (
        <TouchableOpacity
          style={[styles.submitButton, (loading || extraction.loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || extraction.loading}
          accessibilityRole="button"
          accessibilityLabel="บันทึกค่าใช้จ่าย"
        >
          <Text style={styles.submitCheck}>✓</Text>
          <Text style={styles.submitText}>
            {mode === "camera" && previewUri
              ? "สแกนใบเสร็จ"
              : loading
                ? "กำลังบันทึก..."
                : "บันทึกค่าใช้จ่าย"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginBottom: 20,
  },

  // Mode tabs
  modeTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  modeTab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Theme.background.card,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  modeTabActive: {
    borderColor: Theme.accent.green,
    backgroundColor: Theme.accent.green + "15",
  },
  modeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  modeLabel: {
    fontSize: 12,
    color: Theme.text.secondary,
    fontWeight: "500",
  },
  modeLabelActive: {
    color: Theme.accent.green,
    fontWeight: "700",
  },

  // Fields
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.text.secondary,
    marginBottom: 8,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.background.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "600",
    color: Theme.accent.green,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.text.primary,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
  },
  calendarIcon: {
    fontSize: 18,
    marginLeft: 8,
  },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  categoryItem: {
    width: "22%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Theme.background.card,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  categoryItemActive: {
    borderColor: Theme.accent.green,
    backgroundColor: Theme.accent.green + "12",
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 11,
    color: Theme.text.secondary,
    textAlign: "center",
  },
  categoryLabelActive: {
    color: Theme.accent.green,
    fontWeight: "600",
  },

  // Placeholders
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 15,
    color: Theme.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Submit
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.accent.green,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitCheck: {
    fontSize: 18,
    color: "#fff",
    marginRight: 8,
    fontWeight: "bold",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Error
  errorText: {
    fontSize: 13,
    color: Theme.status.critical,
    marginBottom: 8,
  },
});
