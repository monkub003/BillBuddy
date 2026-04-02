import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/theme";
import { PredictionResult } from "@/types";
import { ExpenseCategory } from "@/types";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: "ค่าไฟฟ้า",
  water: "ค่าน้ำ",
  insurance: "ประกัน",
  loan: "สินเชื่อ",
  gas: "น้ำมัน",
  food: "อาหาร",
  transport: "การเดินทาง",
  household: "ของใช้ในบ้าน",
  entertainment: "บันเทิง",
  health: "สุขภาพ",
  education: "การศึกษา",
  manual: "อื่นๆ",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  electricity: Theme.chart.electricity,
  water: Theme.chart.water,
  insurance: Theme.chart.insurance,
  loan: Theme.chart.loan,
  gas: Theme.chart.gas,
  food: Theme.chart.food,
  transport: Theme.chart.transport,
  household: Theme.chart.household,
  entertainment: Theme.chart.entertainment,
  health: Theme.chart.health,
  education: Theme.chart.education,
  manual: Theme.chart.manual,
};

interface Props {
  predictions: PredictionResult[];
}

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PredictionCard({ predictions }: Props) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>การคาดการณ์ค่าใช้จ่าย</Text>
      {predictions.map((p) => {
        const color = CATEGORY_COLORS[p.category] ?? Theme.text.muted;
        const label = CATEGORY_LABELS[p.category] ?? p.category;
        const confidencePct = Math.round(p.confidence * 100);

        return (
          <View key={p.category} style={styles.row}>
            <View style={styles.labelContainer}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.categoryText}>{label}</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rangeText}>
                {formatCurrency(p.predictedMin)} – {formatCurrency(p.predictedMax)}
              </Text>
              <Text style={[styles.confidenceText, { color }]}>
                {confidencePct}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.text.primary,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    color: Theme.text.primary,
  },
  valueContainer: {
    alignItems: "flex-end",
  },
  rangeText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.text.primary,
  },
  confidenceText: {
    fontSize: 12,
    marginTop: 2,
  },
});
