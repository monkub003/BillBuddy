import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { ExpenseCategory } from "@/types";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "insurance", label: "Insurance" },
  { value: "loan", label: "Loan" },
  { value: "gas", label: "Gas" },
  { value: "manual", label: "Other" },
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
      setValidationError("Amount must be greater than 0");
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
      Alert.alert("Success", "Expense added successfully", [
        { text: "OK", onPress: () => router.navigate("/(tabs)") },
      ]);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <Text className="text-lg font-semibold text-gray-800 mb-4">
        Add Expense
      </Text>

      {/* Category selector */}
      <Text className="text-sm text-gray-600 mb-1">Category</Text>
      <View className="flex-row flex-wrap mb-4">
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            onPress={() => setCategory(c.value)}
            className={`mr-2 mb-2 px-3 py-2 rounded-lg ${
              category === c.value ? "bg-blue-500" : "bg-gray-200"
            }`}
          >
            <Text
              className={`text-sm ${
                category === c.value ? "text-white font-medium" : "text-gray-700"
              }`}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount input */}
      <Text className="text-sm text-gray-600 mb-1">Amount (THB)</Text>
      <TextInput
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Due date input */}
      <Text className="text-sm text-gray-600 mb-1">Due Date (YYYY-MM-DD)</Text>
      <TextInput
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="2025-01-15"
        value={dueDate}
        onChangeText={setDueDate}
      />

      {/* Is paid toggle */}
      <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4">
        <Text className="text-base text-gray-700">Already Paid</Text>
        <Switch value={isPaid} onValueChange={setIsPaid} />
      </View>

      {validationError && (
        <Text className="text-sm text-red-500 mb-3">{validationError}</Text>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading}
        className={`rounded-lg py-4 items-center ${
          loading ? "bg-blue-300" : "bg-blue-500"
        }`}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? "Saving..." : "Add Expense"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
