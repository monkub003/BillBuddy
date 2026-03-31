import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useIncomeStore } from "@/store/incomeStore";
import { apiClient } from "@/lib/api";

export default function SettingsScreen() {
  const { monthlyIncome, setMonthlyIncome } = useIncomeStore();
  const [incomeInput, setIncomeInput] = useState(
    monthlyIncome ? String(monthlyIncome) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIncomeInput(monthlyIncome ? String(monthlyIncome) : "");
  }, [monthlyIncome]);

  const handleSave = async () => {
    const value = parseFloat(incomeInput);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Validation Error", "Please enter a valid positive income amount");
      return;
    }

    setSaving(true);
    try {
      await apiClient("/users/income", {
        method: "PUT",
        body: JSON.stringify({ monthlyIncome: value }),
      });
      setMonthlyIncome(value);
      Alert.alert("Saved", "Monthly income updated successfully");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save income"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 p-6">
        <Text className="text-xl font-bold text-gray-800 mb-6">Settings</Text>

        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Monthly Income (THB)
          </Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-4 py-3 text-base"
            keyboardType="decimal-pad"
            placeholder="Enter your monthly income"
            value={incomeInput}
            onChangeText={setIncomeInput}
          />
          {monthlyIncome && monthlyIncome > 0 && (
            <Text className="text-xs text-gray-400 mt-2">
              Current: ฿{monthlyIncome.toLocaleString()}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className={`rounded-lg py-4 items-center mt-4 ${
            saving ? "bg-blue-300" : "bg-blue-500"
          }`}
        >
          <Text className="text-white font-semibold text-base">
            {saving ? "Saving..." : "Save Income"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
