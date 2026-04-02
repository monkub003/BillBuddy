import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/theme";

interface Props {
  /** Ratio of total expenses to monthly income (0.0 - 1.0+), or null if no income set */
  incomeRatio: number | null;
  /** Monthly income value, null means user hasn't set income */
  monthlyIncome: number | null;
}

function getHealthStatus(ratio: number): {
  label: string;
  color: string;
} {
  if (ratio <= 0.7) {
    return { label: "อยู่ในเกณฑ์ที่ดี", color: Theme.status.healthy };
  }
  if (ratio <= 0.9) {
    return { label: "ควรระวัง", color: Theme.status.warning };
  }
  return { label: "เกินงบ", color: Theme.status.critical };
}

export function ExpenseIncomeRatioCard({ incomeRatio, monthlyIncome }: Props) {
  // Hide card when user hasn't set monthly income (Req 6.5)
  if (monthlyIncome === null || monthlyIncome === undefined) {
    return null;
  }

  const ratio = incomeRatio ?? 0;
  const percentage = Math.round(ratio * 100);
  const { label, color } = getHealthStatus(ratio);
  // Clamp progress bar to 100%
  const progressWidth = Math.min(ratio, 1) * 100;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>สัดส่วนรายจ่าย/รายได้</Text>

      <Text style={[styles.percentage, { color }]}>{percentage}%</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressWidth}%`, backgroundColor: color },
          ]}
        />
      </View>

      <Text style={[styles.statusText, { color }]}>{label}</Text>
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
  percentage: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
