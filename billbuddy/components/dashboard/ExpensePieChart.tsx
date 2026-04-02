import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { Expense, ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  electricity: Theme.chart.electricity,
  water: Theme.chart.water,
  insurance: Theme.chart.insurance,
  loan: Theme.chart.loan,
  gas: Theme.chart.gas,
  food: Theme.chart.food,
  transport: Theme.chart.transport,
  household: Theme.chart.household,
  entertainment: Theme.chart.entertainment,
  health: Theme.chart.health,
  education: Theme.chart.education,
  manual: Theme.chart.manual,
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: "ค่าไฟ",
  water: "ค่าน้ำ",
  insurance: "ประกัน",
  loan: "สินเชื่อ",
  gas: "น้ำมัน",
  food: "อาหาร",
  transport: "การเดินทาง",
  household: "ของใช้ในบ้าน",
  entertainment: "บันเทิง",
  health: "สุขภาพ",
  education: "การศึกษา",
  manual: "อื่นๆ",
};

interface CategoryData {
  category: ExpenseCategory;
  total: number;
  percentage: number;
  color: string;
  label: string;
}

interface Props {
  expenses: Expense[];
}

function computeCategoryData(expenses: Expense[]): CategoryData[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }

  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  if (grandTotal === 0) return [];

  return Array.from(totals.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: (total / grandTotal) * 100,
      color: CATEGORY_COLORS[category] ?? Theme.text.muted,
      label: CATEGORY_LABELS[category] ?? category,
    }))
    .sort((a, b) => b.total - a.total);
}

export function ExpensePieChart({ expenses }: Props) {
  const router = useRouter();
  const data = computeCategoryData(expenses);

  if (data.length === 0) return null;

  const handleCategoryPress = (category: ExpenseCategory) => {
    router.push({ pathname: "/(tabs)", params: { category } });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>ค่าใช้จ่ายตามหมวดหมู่</Text>
      <View style={styles.chartRow}>
        <DonutChart data={data} size={140} strokeWidth={24} />
        <View style={styles.legend}>
          {data.slice(0, 6).map((item) => (
            <TouchableOpacity
              key={item.category}
              style={styles.legendItem}
              onPress={() => handleCategoryPress(item.category)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} ${item.percentage.toFixed(0)}%`}
            >
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.legendPercent}>
                {item.percentage.toFixed(0)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ── SVG Donut Chart ── */

interface DonutChartProps {
  data: CategoryData[];
  size: number;
  strokeWidth: number;
}

function DonutChart({ data, size, strokeWidth }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments with cumulative offset
  let cumulativePercent = 0;
  const segments = data.map((item) => {
    const segment = {
      color: item.color,
      percent: item.percentage,
      offset: cumulativePercent,
    };
    cumulativePercent += item.percentage;
    return segment;
  });

  return (
    <Svg width={size} height={size}>
      {/* Background ring */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Data segments */}
      {segments.map((seg, i) => {
        const dashLength = (seg.percent / 100) * circumference;
        const dashGap = circumference - dashLength;
        // Rotate so segment starts at correct position
        // -90 to start from top, then add offset rotation
        const rotation = -90 + (seg.offset / 100) * 360;

        return (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${dashGap}`}
            strokeLinecap="butt"
            rotation={rotation}
            origin={`${center}, ${center}`}
          />
        );
      })}
    </Svg>
  );
}

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
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: Theme.text.secondary,
    flex: 1,
  },
  legendPercent: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.text.primary,
  },
});
