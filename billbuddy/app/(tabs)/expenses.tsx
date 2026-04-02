import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useExpenses } from "@/hooks/useExpenses";
import { Expense, ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

// ─── Category config ────────────────────────────────────────

interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
}

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  electricity: { label: "สาธารณูปโภค", icon: "✉️", color: Theme.chart.electricity },
  water: { label: "ค่าน้ำ", icon: "💧", color: Theme.chart.water },
  insurance: { label: "ประกัน", icon: "🛡️", color: Theme.chart.insurance },
  loan: { label: "สินเชื่อ", icon: "🏦", color: Theme.chart.loan },
  gas: { label: "น้ำมัน", icon: "⛽", color: Theme.chart.gas },
  food: { label: "อาหาร", icon: "🍽️", color: Theme.status.critical },
  transport: { label: "การเดินทาง", icon: "🚗", color: Theme.chart.water },
  household: { label: "ของใช้ในบ้าน", icon: "🏠", color: Theme.status.healthy },
  entertainment: { label: "บันเทิง", icon: "🎬", color: Theme.chart.manual },
  health: { label: "สุขภาพ", icon: "💊", color: Theme.status.critical },
  education: { label: "การศึกษา", icon: "📚", color: Theme.chart.water },
  manual: { label: "อื่นๆ", icon: "✏️", color: Theme.text.muted },
};

type FilterKey = "all" | ExpenseCategory;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "electricity", label: "สาธารณูปโภค" },
  { key: "food", label: "อาหาร" },
  { key: "transport", label: "การเดินทาง" },
  { key: "household", label: "ของใช้ในบ้าน" },
];

// ─── Helpers ────────────────────────────────────────────────

const SHORT_THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const FULL_THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${SHORT_THAI_MONTHS[d.getMonth()]}`;
}

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function extractionIcon(via: string): string {
  switch (via) {
    case "email": return "✉️";
    case "image": return "📷";
    default: return "✏️";
  }
}

// ─── Expense Row ────────────────────────────────────────────

function ExpenseRow({ item }: { item: Expense }) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.manual;
  const icon = extractionIcon(item.extractedVia);

  return (
    <View style={rowStyles.container}>
      <View style={[rowStyles.iconCircle, { borderColor: meta.color + "44" }]}>
        <Text style={rowStyles.icon}>{icon}</Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.title} numberOfLines={1}>
          {item.rawSourceRef || meta.label}
        </Text>
        <Text style={rowStyles.subtitle}>
          {meta.label} · {formatDate(item.dueDate)}
        </Text>
      </View>
      <Text style={rowStyles.amount}>{formatCurrency(item.amount)}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: Theme.background.primary,
  },
  icon: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.text.primary,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: Theme.text.secondary,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.text.primary,
    marginLeft: 8,
  },
});

// ─── Main Screen ────────────────────────────────────────────

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, loading, error, fetchExpenses } = useExpenses();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

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
    fetchExpenses({});
  }, [fetchExpenses]);

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const monthFiltered = expenses.filter((e) => {
    const d = new Date(e.dueDate);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });

  const filtered =
    activeFilter === "all"
      ? monthFiltered
      : monthFiltered.filter((e) => e.category === activeFilter);

  // Sort by dueDate descending
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );

  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => <ExpenseRow item={item} />,
    []
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>รายการค่าใช้จ่าย</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
      </View>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn}>
          <Text style={styles.monthNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthNavLabel}>
          {FULL_THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
          <Text style={styles.monthNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeFilter === tab.key }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.filterLabel,
                activeFilter === tab.key && styles.filterLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* List */}
      {loading && sorted.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.accent.green} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>ยังไม่มีรายการค่าใช้จ่าย</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadData}
              tintColor={Theme.accent.green}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Theme.text.primary,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.accent.green,
  },

  // Month navigator
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
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

  // Filter tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Theme.background.card,
  },
  filterTabActive: {
    backgroundColor: Theme.accent.green,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.text.secondary,
  },
  filterLabelActive: {
    color: "#fff",
    fontWeight: "700",
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Theme.text.secondary,
  },
  errorBanner: {
    backgroundColor: Theme.status.critical + "20",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Theme.status.critical,
  },
});
