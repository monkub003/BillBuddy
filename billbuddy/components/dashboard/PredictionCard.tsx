import React from "react";
import { View, Text } from "react-native";
import { PredictionResult } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  electricity: "Electricity",
  water: "Water",
  insurance: "Insurance",
  loan: "Loan",
  gas: "Gas",
  manual: "Other",
};

interface Props {
  predictions: PredictionResult[];
}

export function PredictionCard({ predictions }: Props) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <View className="bg-white rounded-xl p-4 mb-4">
      <Text className="text-base font-semibold text-gray-800 mb-2">
        Predicted Expenses
      </Text>
      {predictions.map((p) => (
        <View
          key={p.category}
          className="flex-row justify-between items-center py-2 border-b border-gray-50"
        >
          <Text className="text-sm text-gray-700">
            {CATEGORY_LABELS[p.category] ?? p.category}
          </Text>
          <Text className="text-sm font-medium text-blue-600">
            ฿{p.predictedMin.toLocaleString()} – ฿{p.predictedMax.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}
