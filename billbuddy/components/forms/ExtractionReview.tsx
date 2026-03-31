import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { ExtractionResult, ExpenseCategory } from "@/types";

const LOW_CONFIDENCE_THRESHOLD = 0.5;

interface Props {
  extraction: ExtractionResult;
  sourceRef: string;
  extractedVia: "email" | "image";
  onConfirm?: () => void;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "text-yellow-600";
  return "text-red-600";
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "Medium";
  return "Low";
}

export function ExtractionReview({
  extraction,
  sourceRef,
  extractedVia,
  onConfirm,
}: Props) {
  const { createExpense, loading } = useExpenses();

  const [amount, setAmount] = useState(String(extraction.amount.value));
  const [category, setCategory] = useState(extraction.category.value);
  const [dueDate, setDueDate] = useState(extraction.dueDate.value);

  const isLowConfidence = (confidence: number) =>
    confidence < LOW_CONFIDENCE_THRESHOLD;

  const handleConfirm = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Validation Error", "Amount must be greater than 0");
      return;
    }

    const result = await createExpense({
      category: category as ExpenseCategory,
      amount: numAmount,
      dueDate,
      isPaid: false,
      extractedVia,
      rawSourceRef: sourceRef,
    });

    if (result) {
      Alert.alert("Success", "Expense confirmed and saved", [
        {
          text: "OK",
          onPress: () => {
            onConfirm?.();
            router.navigate("/(tabs)");
          },
        },
      ]);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <Text className="text-lg font-semibold text-gray-800 mb-2">
        Review Extracted Data
      </Text>
      <Text className="text-sm text-gray-400 mb-4">
        Please verify the extracted fields. Low-confidence fields are
        highlighted for correction.
      </Text>

      {/* Amount */}
      <View
        className={`bg-white rounded-lg p-4 mb-3 border ${
          isLowConfidence(extraction.amount.confidence)
            ? "border-red-300"
            : "border-gray-200"
        }`}
      >
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm font-medium text-gray-700">Amount (THB)</Text>
          <Text className={`text-xs ${confidenceColor(extraction.amount.confidence)}`}>
            {confidenceLabel(extraction.amount.confidence)} (
            {(extraction.amount.confidence * 100).toFixed(0)}%)
          </Text>
        </View>
        <TextInput
          className="border border-gray-200 rounded px-3 py-2 text-base"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        {isLowConfidence(extraction.amount.confidence) && (
          <Text className="text-xs text-red-500 mt-1">
            ⚠ Low confidence — please verify this value
          </Text>
        )}
      </View>

      {/* Category */}
      <View
        className={`bg-white rounded-lg p-4 mb-3 border ${
          isLowConfidence(extraction.category.confidence)
            ? "border-red-300"
            : "border-gray-200"
        }`}
      >
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm font-medium text-gray-700">Category</Text>
          <Text className={`text-xs ${confidenceColor(extraction.category.confidence)}`}>
            {confidenceLabel(extraction.category.confidence)} (
            {(extraction.category.confidence * 100).toFixed(0)}%)
          </Text>
        </View>
        <TextInput
          className="border border-gray-200 rounded px-3 py-2 text-base"
          value={category}
          onChangeText={(v) => setCategory(v as ExpenseCategory)}
        />
        {isLowConfidence(extraction.category.confidence) && (
          <Text className="text-xs text-red-500 mt-1">
            ⚠ Low confidence — please verify this value
          </Text>
        )}
      </View>

      {/* Due Date */}
      <View
        className={`bg-white rounded-lg p-4 mb-3 border ${
          isLowConfidence(extraction.dueDate.confidence)
            ? "border-red-300"
            : "border-gray-200"
        }`}
      >
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm font-medium text-gray-700">Due Date</Text>
          <Text className={`text-xs ${confidenceColor(extraction.dueDate.confidence)}`}>
            {confidenceLabel(extraction.dueDate.confidence)} (
            {(extraction.dueDate.confidence * 100).toFixed(0)}%)
          </Text>
        </View>
        <TextInput
          className="border border-gray-200 rounded px-3 py-2 text-base"
          value={dueDate}
          onChangeText={setDueDate}
        />
        {isLowConfidence(extraction.dueDate.confidence) && (
          <Text className="text-xs text-red-500 mt-1">
            ⚠ Low confidence — please verify this value
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={loading}
        className={`rounded-lg py-4 items-center mt-2 ${
          loading ? "bg-blue-300" : "bg-blue-500"
        }`}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? "Saving..." : "Confirm & Save"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
