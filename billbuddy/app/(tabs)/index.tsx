import React, { useCallback, useState } from "react";
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
import { useFocusEffect } from "expo-router";
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
  const { predictions, fetchPredictions } = usePrediction();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const thaiMonthYear = `${THAI_MONTHS[selectedMonth - 1]} ${selectedYear + 543}`;

  const insets = useSafeAreaInsets();

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const loadData = useCallback(() => {
    // Fetch ALL expenses (no month filter) so charts have full data
    fetchExpenses({});
    fetchPredictions();
  }, [fetchExpenses, fetchPredictions]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Filter expenses locally for the selected month's summary cards
  const selectedMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.dueDate);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });

  const dashboard = useDashboard(selectedMonthExpenses);
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
        <Text style={styles.greeting}>สวัสดี, BillBuddy 👋</Text>
      </View>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn}>
          <Text style={styles.monthNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthNavLabel}>{thaiMonthYear}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
          <Text style={styles.monthNavArrow}>›</Text>
        </TouchableOpacity>
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
          {monthlyIncome != null && (
            <Text style={styles.budgetSubtitle}>
              จาก {formatCurrency(monthlyIncome)}
            </Text>
          )}
        </View>
      </View>

      {/* Expense-to-Income Ratio */}
      <ExpenseIncomeRatioCard
        incomeRatio={dashboard.incomeRatio}
        monthlyIncome={monthlyIncome}
      />

      {/* Category Pie Chart */}
      <ExpensePieChart expenses={selectedMonthExpenses} />

      {/* Monthly Bar Chart (uses all expenses for 6-month view) */}
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
    marginBottom: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginTop: 4,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.background.card,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavArrow: {
    fontSize: 22,
    fontWeight: "700",
    color: Theme.text.primary,
  },
  monthNavLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.text.primary,
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

});
