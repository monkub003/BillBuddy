import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { ExtractionResult, ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const VERY_LOW_CONFIDENCE_THRESHOLD = 0.3;

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

interface Props {
  extraction: ExtractionResult;
  sourceRef: string;
  extractedVia: "email" | "image";
  onConfirm?: () => void;
  onCancel?: () => void;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return Theme.status.healthy;
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return Theme.status.warning;
  return Theme.status.critical;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "สูง";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "ปานกลาง";
  return "ต่ำ";
}

function hasVeryLowConfidence(extraction: ExtractionResult): boolean {
  return (
    extraction.amount.confidence < VERY_LOW_CONFIDENCE_THRESHOLD ||
    extraction.category.confidence < VERY_LOW_CONFIDENCE_THRESHOLD ||
    extraction.dueDate.confidence < VERY_LOW_CONFIDENCE_THRESHOLD
  );
}

export function ExtractionReview({
  extraction,
  sourceRef,
  extractedVia,
  onConfirm,
  onCancel,
}: Props) {
  const { createExpense, loading } = useExpenses();

  const [amount, setAmount] = useState(String(extraction.amount.value));
  const [category, setCategory] = useState<ExpenseCategory>(extraction.category.value);
  const [dueDate, setDueDate] = useState(extraction.dueDate.value);

  const handleConfirm = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("ข้อมูลไม่ถูกต้อง", "จำนวนเงินต้องมากกว่า 0");
      return;
    }

    const result = await createExpense({
      category,
      amount: numAmount,
      dueDate,
      isPaid: false,
      extractedVia,
      rawSourceRef: sourceRef,
    });

    if (result) {
      Alert.alert("สำเร็จ", "บันทึกค่าใช้จ่ายเรียบร้อย", [
        {
          text: "ตกลง",
          onPress: () => {
            onConfirm?.();
            router.navigate("/(tabs)");
          },
        },
      ]);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const showRetakeTips = extractedVia === "image" && hasVeryLowConfidence(extraction);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>ตรวจสอบข้อมูลที่สกัดได้</Text>
      <Text style={styles.subtitle}>
        กรุณาตรวจสอบข้อมูลด้านล่าง ช่องที่ความเชื่อมั่นต่ำควรแก้ไขก่อนยืนยัน
      </Text>

      {/* Retake tips for very low quality images */}
      {showRetakeTips && (
        <View style={styles.retakeBanner}>
          <Text style={styles.retakeBannerTitle}>⚠ คุณภาพรูปต่ำ</Text>
          <Text style={styles.retakeBannerText}>
            ลองถ่ายรูปใหม่ให้ชัดขึ้น โดย:
          </Text>
          <Text style={styles.retakeTip}>• ถ่ายในที่มีแสงสว่างเพียงพอ</Text>
          <Text style={styles.retakeTip}>• วางบิลบนพื้นเรียบ ไม่ยับ</Text>
          <Text style={styles.retakeTip}>• จัดให้บิลอยู่ในกรอบภาพทั้งหมด</Text>
          <Text style={styles.retakeTip}>• หลีกเลี่ยงเงาและแสงสะท้อน</Text>
        </View>
      )}

      {/* Amount field */}
      <View
        style={[
          styles.fieldCard,
          extraction.amount.confidence < LOW_CONFIDENCE_THRESHOLD && styles.fieldCardWarning,
        ]}
      >
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel}>จำนวนเงิน (THB)</Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(extraction.amount.confidence) + "22" }]}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(extraction.amount.confidence) }]} />
            <Text style={[styles.confidenceText, { color: confidenceColor(extraction.amount.confidence) }]}>
              {confidenceLabel(extraction.amount.confidence)} ({(extraction.amount.confidence * 100).toFixed(0)}%)
            </Text>
          </View>
        </View>
        <TextInput
          style={styles.textInput}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={Theme.text.muted}
          placeholder="0.00"
        />
        {extraction.amount.confidence < LOW_CONFIDENCE_THRESHOLD && (
          <Text style={styles.warningText}>⚠ ความเชื่อมั่นต่ำ — กรุณาตรวจสอบค่านี้</Text>
        )}
      </View>

      {/* Category field */}
      <View
        style={[
          styles.fieldCard,
          extraction.category.confidence < LOW_CONFIDENCE_THRESHOLD && styles.fieldCardWarning,
        ]}
      >
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel}>หมวดหมู่</Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(extraction.category.confidence) + "22" }]}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(extraction.category.confidence) }]} />
            <Text style={[styles.confidenceText, { color: confidenceColor(extraction.category.confidence) }]}>
              {confidenceLabel(extraction.category.confidence)} ({(extraction.category.confidence * 100).toFixed(0)}%)
            </Text>
          </View>
        </View>
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
        {extraction.category.confidence < LOW_CONFIDENCE_THRESHOLD && (
          <Text style={styles.warningText}>⚠ ความเชื่อมั่นต่ำ — กรุณาเลือกหมวดหมู่ที่ถูกต้อง</Text>
        )}
      </View>

      {/* Due Date field */}
      <View
        style={[
          styles.fieldCard,
          extraction.dueDate.confidence < LOW_CONFIDENCE_THRESHOLD && styles.fieldCardWarning,
        ]}
      >
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel}>วันครบกำหนด</Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(extraction.dueDate.confidence) + "22" }]}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(extraction.dueDate.confidence) }]} />
            <Text style={[styles.confidenceText, { color: confidenceColor(extraction.dueDate.confidence) }]}>
              {confidenceLabel(extraction.dueDate.confidence)} ({(extraction.dueDate.confidence * 100).toFixed(0)}%)
            </Text>
          </View>
        </View>
        <TextInput
          style={styles.textInput}
          value={dueDate}
          onChangeText={setDueDate}
          placeholderTextColor={Theme.text.muted}
          placeholder="YYYY-MM-DD"
        />
        {extraction.dueDate.confidence < LOW_CONFIDENCE_THRESHOLD && (
          <Text style={styles.warningText}>⚠ ความเชื่อมั่นต่ำ — กรุณาตรวจสอบวันที่</Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>ยกเลิก</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? "กำลังบันทึก..." : "ยืนยัน"}
          </Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  // Retake tips banner
  retakeBanner: {
    backgroundColor: Theme.status.critical + "1A",
    borderWidth: 1,
    borderColor: Theme.status.critical + "44",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  retakeBannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.status.critical,
    marginBottom: 4,
  },
  retakeBannerText: {
    fontSize: 13,
    color: Theme.text.secondary,
    marginBottom: 8,
  },
  retakeTip: {
    fontSize: 13,
    color: Theme.text.secondary,
    marginLeft: 4,
    lineHeight: 20,
  },
  // Field card
  fieldCard: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.background.card,
  },
  fieldCardWarning: {
    borderColor: Theme.status.critical + "66",
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.text.secondary,
  },
  // Confidence badge
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Text input
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
  warningText: {
    fontSize: 12,
    color: Theme.status.critical,
    marginTop: 8,
  },
  // Category picker
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
  // Buttons
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Theme.background.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.text.muted + "33",
  },
  cancelButtonText: {
    color: Theme.text.secondary,
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: Theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
