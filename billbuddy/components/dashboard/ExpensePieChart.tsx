import React from "react";
import { View, Text, Dimensions } from "react-native";
import { PieChart } from "react-native-chart-kit";
import { Expense, ExpenseCategory } from "@/types";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  electricity: "#f59e0b",
  water: "#3b82f6",
  insurance: "#8b5cf6",
  loan: "#ef4444",
  gas: "#10b981",
  manual: "#6b7280",
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: "Electricity",
  water: "Water",
  insurance: "Insurance",
  loan: "Loan",
  gas: "Gas",
  manual: "Other",
};

interface Props {
  expenses: Expense[];
}

export function ExpensePieChart({ expenses }: Props) {
  if (expenses.length === 0) {
    return null;
  }

  const categoryTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const data = Object.entries(categoryTotals).map(([category, amount]) => ({
    name: CATEGORY_LABELS[category as ExpenseCategory] ?? category,
    amount,
    color: CATEGORY_COLORS[category as ExpenseCategory] ?? "#9ca3af",
    legendFontColor: "#374151",
    legendFontSize: 12,
  }));

  const screenWidth = Dimensions.get("window").width;

  return (
    <View className="bg-white rounded-xl p-4 mb-4">
      <Text className="text-base font-semibold text-gray-800 mb-2">
        Category Distribution
      </Text>
      <PieChart
        data={data}
        width={screenWidth - 48}
        height={200}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft="0"
      />
    </View>
  );
}
