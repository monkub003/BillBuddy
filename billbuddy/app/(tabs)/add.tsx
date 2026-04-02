import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { useExtraction } from "@/hooks/useExtraction";
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

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDisplayDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

function toISODate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ─── Date Picker Modal ─────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

function DatePickerModal({ visible, value, onConfirm, onCancel }: DatePickerModalProps) {
  const [day, setDay] = useState(value.getDate());
  const [month, setMonth] = useState(value.getMonth() + 1);
  const [year, setYear] = useState(value.getFullYear());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const maxDay = daysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  // Clamp day if month/year changed
  const safeDay = day > maxDay ? maxDay : day;

  const handleConfirm = () => {
    onConfirm(new Date(year, month - 1, safeDay));
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={pickerStyles.cancelText}>ยกเลิก</Text>
            </TouchableOpacity>
            <Text style={pickerStyles.title}>เลือกวันที่</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={pickerStyles.confirmText}>ตกลง</Text>
            </TouchableOpacity>
          </View>

          <View style={pickerStyles.columns}>
            {/* Day */}
            <View style={pickerStyles.column}>
              <Text style={pickerStyles.columnLabel}>วัน</Text>
              <FlatList
                data={days}
                keyExtractor={(item) => `d-${item}`}
                showsVerticalScrollIndicator={false}
                style={pickerStyles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      pickerStyles.cell,
                      item === safeDay && pickerStyles.cellActive,
                    ]}
                    onPress={() => setDay(item)}
                  >
                    <Text
                      style={[
                        pickerStyles.cellText,
                        item === safeDay && pickerStyles.cellTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Month */}
            <View style={[pickerStyles.column, { flex: 1.5 }]}>
              <Text style={pickerStyles.columnLabel}>เดือน</Text>
              <FlatList
                data={months}
                keyExtractor={(item) => `m-${item}`}
                showsVerticalScrollIndicator={false}
                style={pickerStyles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      pickerStyles.cell,
                      item === month && pickerStyles.cellActive,
                    ]}
                    onPress={() => setMonth(item)}
                  >
                    <Text
                      style={[
                        pickerStyles.cellText,
                        item === month && pickerStyles.cellTextActive,
                      ]}
                    >
                      {THAI_MONTHS[item - 1]}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Year */}
            <View style={pickerStyles.column}>
              <Text style={pickerStyles.columnLabel}>ปี</Text>
              <FlatList
                data={years}
                keyExtractor={(item) => `y-${item}`}
                showsVerticalScrollIndicator={false}
                style={pickerStyles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      pickerStyles.cell,
                      item === year && pickerStyles.cellActive,
                    ]}
                    onPress={() => setYear(item)}
                  >
                    <Text
                      style={[
                        pickerStyles.cellText,
                        item === year && pickerStyles.cellTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: Theme.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.text.primary,
  },
  cancelText: {
    fontSize: 15,
    color: Theme.text.secondary,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.accent.green,
  },
  columns: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  columnLabel: {
    fontSize: 12,
    color: Theme.text.muted,
    marginBottom: 8,
    fontWeight: "600",
  },
  list: {
    maxHeight: 220,
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginVertical: 2,
    alignItems: "center",
  },
  cellActive: {
    backgroundColor: Theme.accent.green + "22",
  },
  cellText: {
    fontSize: 15,
    color: Theme.text.secondary,
  },
  cellTextActive: {
    color: Theme.accent.green,
    fontWeight: "700",
  },
});

// ─── Main Screen ────────────────────────────────────────────

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { createExpense, loading } = useExpenses();
  const extraction = useExtraction();

  const [mode, setMode] = useState<InputMode>("manual");
  const [amount, setAmount] = useState("0.00");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setValidationError(null);

    if (mode === "camera") {
      Alert.alert("ถ่ายรูปบิล", "ฟีเจอร์ถ่ายรูปบิลจะเปิดกล้องเพื่อสแกนใบเสร็จ");
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
      dueDate: toISODate(selectedDate),
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
            setSelectedDate(new Date());
            setSelectedCategory(0);
            router.navigate("/(tabs)/expenses");
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
          <TouchableOpacity
            style={styles.inputRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="เลือกวันที่"
          >
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>

          <DatePickerModal
            visible={showDatePicker}
            value={selectedDate}
            onConfirm={(date) => {
              setSelectedDate(date);
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
          />

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

      {/* Camera placeholder */}
      {mode === "camera" && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.placeholderText}>
            ถ่ายรูปใบเสร็จเพื่อให้ AI สกัดข้อมูลอัตโนมัติ
          </Text>
        </View>
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

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="บันทึกค่าใช้จ่าย"
      >
        <Text style={styles.submitCheck}>✓</Text>
        <Text style={styles.submitText}>
          {loading ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
        </Text>
      </TouchableOpacity>
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
  dateText: {
    flex: 1,
    fontSize: 15,
    color: Theme.text.primary,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
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
