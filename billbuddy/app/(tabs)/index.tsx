import React, { useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { useIncomeStore } from "@/store/incomeStore";
import {
  ExpensePieChart,
  MonthSummary,
  UpcomingBills,
} from "@/components/dashboard";
import { AlertBanner } from "@/components/shared";

function computeAlertLevel(
  income: number | null,
  totalExpenses: number
): "none" | "warning" | "critical" {
  if (!income || income <= 0) return "none";
  const ratio = totalExpenses / income;
  if (ratio > 1.0) return "critical";
  if (ratio > 0.9) return "warning";
  return "none";
}

export default function DashboardScreen() {
  const { expenses, loading, error, fetchExpenses } = useExpenses();
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const loadData = useCallback(() => {
    fetchExpenses({ month: currentMonth, year: currentYear });
  }, [fetchExpenses, currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const alertLevel = computeAlertLevel(monthlyIncome, totalExpenses);

  if (loading && expenses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (expenses.length === 0 && !loading) {
    return (
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="flex-1 items-center justify-center p-6"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
      >
        <Text className="text-lg font-semibold text-gray-600 mb-2">
          No expenses yet
        </Text>
        <Text className="text-sm text-gray-400 text-center">
          Add your first expense using the manual form or scan a bill with the
          camera.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadData} />
      }
    >
      {error && (
        <View className="bg-red-50 rounded-xl p-3 mb-4">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      )}

      {monthlyIncome && monthlyIncome > 0 && (
        <AlertBanner
          level={alertLevel}
          monthlyIncome={monthlyIncome}
          totalExpenses={totalExpenses}
        />
      )}

      <MonthSummary expenses={expenses} monthlyIncome={monthlyIncome} />
      <ExpensePieChart expenses={expenses} />
      <UpcomingBills expenses={expenses} />
    </ScrollView>
  );
}
