import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Expense } from "@/types";
import { Theme } from "@/constants/theme";

const THAI_MONTH_ABBR = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

interface MonthData {
  month: number; // 0-11
  year: number;
  label: string;
  total: number;
  isCurrent: boolean;
}

interface Props {
  expenses: Expense[];
}

function computeMonthlyData(expenses: Expense[]): MonthData[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Build last 6 months (including current)
  const months: MonthData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    months.push({
      month: m,
      year: y,
      label: THAI_MONTH_ABBR[m],
      total: 0,
      isCurrent: m === currentMonth && y === currentYear,
    });
  }

  // Aggregate expense amounts into matching months
  for (const e of expenses) {
    const date = new Date(e.dueDate);
    const eMonth = date.getMonth();
    const eYear = date.getFullYear();
    const entry = months.find((md) => md.month === eMonth && md.year === eYear);
    if (entry) {
      entry.total += e.amount;
    }
  }

  return months;
}

export function MonthSummary({ expenses }: Props) {
  const data = useMemo(() => computeMonthlyData(expenses), [expenses]);
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>ค่าใช้จ่ายรายเดือน</Text>
      <View style={styles.chartContainer}>
        {data.map((item) => {
          const barHeight = (item.total / maxTotal) * MAX_BAR_HEIGHT;
          const barColor = item.isCurrent
            ? Theme.accent.green
            : Theme.text.muted;

          return (
            <View key={`${item.year}-${item.month}`} style={styles.barColumn}>
              <Text style={styles.amountLabel}>
                {item.total > 0
                  ? `฿${Math.round(item.total / 1000)}k`
                  : ""}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, item.total > 0 ? 4 : 0),
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.monthLabel,
                  item.isCurrent && styles.monthLabelCurrent,
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const MAX_BAR_HEIGHT = 100;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.text.primary,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    fontSize: 10,
    color: Theme.text.secondary,
    marginBottom: 2,
  },
  barTrack: {
    height: MAX_BAR_HEIGHT,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
  },
  bar: {
    width: 24,
    borderRadius: 4,
  },
  monthLabel: {
    fontSize: 11,
    color: Theme.text.muted,
    marginTop: 4,
  },
  monthLabelCurrent: {
    color: Theme.accent.green,
    fontWeight: "600",
  },
});
