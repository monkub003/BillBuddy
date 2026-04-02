import React from "react";
import { View, Text } from "react-native";

type AlertLevel = "none" | "warning" | "critical";

interface Props {
  level: AlertLevel;
  monthlyIncome: number;
  totalExpenses: number;
}

export function AlertBanner({ level, monthlyIncome, totalExpenses }: Props) {
  if (level === "none") {
    return null;
  }

  const isWarning = level === "warning";
  const ratio = ((totalExpenses / monthlyIncome) * 100).toFixed(0);

  return (
    <View
      className={`rounded-xl p-4 mb-4 ${
        isWarning ? "bg-yellow-50 border border-yellow-300" : "bg-red-50 border border-red-300"
      }`}
    >
      <Text
        className={`text-sm font-semibold ${
          isWarning ? "text-yellow-800" : "text-red-800"
        }`}
      >
        {isWarning ? "⚠️ Budget Warning" : "🚨 Overspending Alert"}
      </Text>
      <Text
        className={`text-xs mt-1 ${
          isWarning ? "text-yellow-700" : "text-red-700"
        }`}
      >
        Your expenses are at {ratio}% of your monthly income (฿
        {monthlyIncome.toLocaleString()}).
      </Text>
    </View>
  );
}
