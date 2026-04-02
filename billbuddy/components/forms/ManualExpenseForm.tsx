import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "electricity", label: "สาธารณูปโภค" },
  { value: "water", label: "ค่าน้ำ" },
  { value: "insurance", label: "ประกัน" },
  { value: "loan", label: "สินเชื่อ" },
  { value: "gas", label: "น้ำมัน" },
  { value: "food", label: "อาหาร" },
  { value: "transport", label: "การเดินทาง" },
  { value: "household", label: "ของใช้ในบ้าน" },
  { value: "entertainment", label: "บันเทิง" },
  { value: "health", label: "สุขภาพ" },
  { value: "education", label: "การศึกษา" },
  { value: "manual", label: "อื่นๆ" },
];

export function ManualExpenseForm() {
  const { createExpense, loading } = useExpenses();
  const [category, setCategory] = useState<ExpenseCategory>("manual");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPaid, setIsPaid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setValidationError(null);
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError("จำนวนเงินต้องมากกว่า 0");
      return;
    }

    const result = await createExpense({
      category,
      amount: numAmount,
      dueDate,
      isPaid,
      extractedVia: "manual",
    });

    if (result) {
      Alert.alert("สำเร็จ", "บันทึกค่าใช้จ่ายเรียบร้อย", [
        { text: "ตกลง", onPress: () => router.navigate("/(tabs)") },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>เพิ่มค่าใช้จ่าย</Text>

      {/* Category selector */}
      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>หมวดหมู่</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[
                styles.categoryChip,
                category === c.value && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  category === c.value && styles.categoryChipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Amount input */}
      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>จำนวนเงิน (THB)</Text>
        <TextInput
          style={styles.textInput}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={Theme.text.muted}
          placeholder="0.00"
        />
      </View>

      {/* Due date input */}
      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>วันครบกำหนด</Text>
        <TextInput
          style={styles.textInput}
          value={dueDate}
          onChangeText={setDueDate}
          placeholderTextColor={Theme.text.muted}
          placeholder="YYYY-MM-DD"
        />
      </View>

      {/* Is paid toggle */}
      <View style={styles.fieldCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>ชำระแล้ว</Text>
          <Switch
            value={isPaid}
            onValueChange={setIsPaid}
            trackColor={{ false: Theme.text.muted + "44", true: Theme.accent.green + "66" }}
            thumbColor={isPaid ? Theme.accent.green : Theme.text.muted}
          />
        </View>
      </View>

      {validationError && (
        <Text style={styles.errorText}>{validationError}</Text>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginBottom: 16,
  },
  fieldCard: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.text.secondary,
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Theme.background.primary,
    borderWidth: 1,
    borderColor: Theme.text.muted + "33",
  },
  categoryChipActive: {
    backgroundColor: Theme.accent.green + "22",
    borderColor: Theme.accent.green,
  },
  categoryChipText: {
    fontSize: 14,
    color: Theme.text.secondary,
  },
  categoryChipTextActive: {
    color: Theme.accent.green,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: Theme.background.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Theme.text.primary,
    borderWidth: 1,
    borderColor: Theme.text.muted + "33",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    color: Theme.status.critical,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
