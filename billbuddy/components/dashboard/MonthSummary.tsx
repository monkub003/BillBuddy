import React from "react";
import { View, Text } from "react-native";
import { Expense } from "@/types";

interface Props {
  expenses: Expense[];
  monthlyIncome: number | null;
}

export function MonthSummary({ expenses, monthlyIncome }: Props) {
  const totalPaid = expenses
    .filter((e) => e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalUnpaid = expenses
    .filter((e) => !e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  const total = totalPaid + totalUnpaid;

  const incomeRatio =
    monthlyIncome && monthlyIncome > 0 ? total / monthlyIncome : null;

  return (
    <View className="bg-white rounded-xl p-4 mb-4">
      <Text className="text-base font-semibold text-gray-800 mb-3">
        Monthly Summary
      </Text>
      <View className="flex-row justify-between mb-2">
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500">Total</Text>
          <Text className="text-lg font-bold text-gray-900">
            ฿{total.toLocaleString()}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs text-green-600">Paid</Text>
          <Text className="text-lg font-bold text-green-700">
            ฿{totalPaid.toLocaleString()}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs text-red-500">Unpaid</Text>
          <Text className="text-lg font-bold text-red-600">
            ฿{totalUnpaid.toLocaleString()}
          </Text>
        </View>
      </View>
      {incomeRatio !== null && (
        <View className="mt-2 pt-2 border-t border-gray-100">
          <Text className="text-xs text-gray-500 text-center">
            Income Ratio: {(incomeRatio * 100).toFixed(0)}% of ฿
            {monthlyIncome!.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}
