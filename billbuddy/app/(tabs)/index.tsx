import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { useIncomeStore } from "@/store/incomeStore";
import { useDashboard } from "@/hooks/useDashboard";
import { ExpensePieChart, ExpenseIncomeRatioCard, MonthSummary, PredictionCard } from "@/components/dashboard";
import { usePrediction } from "@/hooks/usePrediction";
import { Theme } from "@/constants/theme";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function DashboardScreen() {
  const { expenses, loading, error, fetchExpenses } = useExpenses();
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome);
  const fetchIncome = useIncomeStore((s) => s.fetchIncome);
  const { predictions, fetchPredictions } = usePrediction();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const thaiMonthYear = `${THAI_MONTHS[now.getMonth()]} ${currentYear + 543}`;

  const insets = useSafeAreaInsets();

  const loadData = useCallback(() => {
    fetchExpenses({});
    fetchPredictions();
    fetchIncome();
  }, [fetchExpenses, fetchPredictions, fetchIncome]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const dashboard = useDashboard(expenses);
  const remainingBudget =
    monthlyIncome != null ? monthlyIncome - dashboard.totalExpenses : null;

  // Simple trend indicator placeholder (will be replaced with real data in later tasks)
  const trendPercentage = 9.5;
  const trendDirection = trendPercentage >= 0 ? "+" : "";

  if (loading && expenses.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.accent.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadData}
          tintColor={Theme.accent.green}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.monthText}>{thaiMonthYear}</Text>
        <Text style={styles.greeting}>สวัสดี, BillBuddy 👋</Text>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Summary Cards Row */}
      <View style={styles.summaryRow}>
        {/* Card 1: Total expenses this month */}
        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.cardLabel}>ค่าใช้จ่ายเดือนนี้</Text>
          <Text style={styles.cardAmount}>
            {formatCurrency(dashboard.totalExpenses)}
          </Text>
          <Text style={styles.trendText}>
            {trendDirection}
            {trendPercentage}% จากเดือนก่อน
          </Text>
        </View>

        {/* Card 2: Remaining budget */}
        <View style={[styles.summaryCard, styles.budgetCard]}>
          <Text style={styles.cardLabel}>งบคงเหลือ</Text>
          <Text style={styles.cardAmount}>
            {remainingBudget != null
              ? formatCurrency(remainingBudget)
              : "—"}
          </Text>
          {monthlyIncome != null ? (
            <Text style={styles.budgetSubtitle}>
              จาก {formatCurrency(monthlyIncome)}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
              <Text style={styles.setupIncomeLink}>ตั้งค่ารายได้</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expense-to-Income Ratio */}
      <ExpenseIncomeRatioCard
        incomeRatio={dashboard.incomeRatio}
        monthlyIncome={monthlyIncome}
      />

      {/* Category Pie Chart */}
      <ExpensePieChart expenses={expenses} />

      {/* Monthly Bar Chart */}
      <MonthSummary expenses={expenses} />

      {/* Prediction Card */}
      <PredictionCard predictions={predictions} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.background.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  monthText: {
    fontSize: 14,
    color: Theme.text.secondary,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: Theme.status.critical + "20",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Theme.status.critical,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  expenseCard: {
    backgroundColor: Theme.accent.green,
  },
  budgetCard: {
    backgroundColor: Theme.background.card,
  },
  cardLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: Theme.text.primary,
  },
  trendText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  budgetSubtitle: {
    fontSize: 12,
    color: Theme.text.secondary,
    marginTop: 4,
  },
  setupIncomeLink: {
    fontSize: 12,
    color: Theme.accent.green,
    fontWeight: "600",
    marginTop: 4,
  },

});
