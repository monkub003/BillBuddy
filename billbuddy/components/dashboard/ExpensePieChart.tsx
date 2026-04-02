import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Expense, ExpenseCategory } from "@/types";
import { Theme } from "@/constants/theme";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  electricity: Theme.chart.electricity,
  water: Theme.chart.water,
  insurance: Theme.chart.insurance,
  loan: Theme.chart.loan,
  gas: Theme.chart.gas,
  manual: Theme.chart.manual,
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: "ค่าไฟ",
  water: "ค่าน้ำ",
  insurance: "ประกัน",
  loan: "สินเชื่อ",
  gas: "น้ำมัน",
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
      color: CATEGORY_COLORS[category],
      label: CATEGORY_LABELS[category],
    }))
    .sort((a, b) => b.total - a.total);
}

export function ExpensePieChart({ expenses }: Props) {
  const router = useRouter();

  const data = computeCategoryData(expenses);

  if (data.length === 0) {
    return null;
  }

  const handleCategoryPress = (category: ExpenseCategory) => {
    // Navigate to category detail — uses query param for filtering
    router.push({ pathname: "/(tabs)", params: { category } });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>ค่าใช้จ่ายตามหมวดหมู่</Text>
      <View style={styles.chartRow}>
        {/* Donut chart */}
        <DonutChart data={data} size={120} strokeWidth={20} />
        {/* Legend */}
        <View style={styles.legend}>
          {data.map((item) => (
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


/* ── Donut Chart (View-based, no SVG dependency) ── */

interface DonutChartProps {
  data: CategoryData[];
  size: number;
  strokeWidth: number;
}

function DonutChart({ data, size, strokeWidth }: DonutChartProps) {
  // Build conic-gradient-like segments using absolute-positioned half-circle Views.
  // Each segment is a colored arc rendered via rotated half-circles clipped by overflow.
  const segments = buildSegments(data);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {segments.map((seg, i) => (
        <HalfCircleSegment
          key={i}
          size={size}
          startAngle={seg.startAngle}
          sweepAngle={seg.sweepAngle}
          color={seg.color}
        />
      ))}
      {/* Inner circle to create donut hole */}
      <View
        style={{
          position: "absolute",
          top: strokeWidth,
          left: strokeWidth,
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          backgroundColor: Theme.background.card,
        }}
      />
    </View>
  );
}

interface Segment {
  startAngle: number;
  sweepAngle: number;
  color: string;
}

function buildSegments(data: CategoryData[]): Segment[] {
  const segments: Segment[] = [];
  let currentAngle = -90; // start from top

  for (const item of data) {
    const sweep = (item.percentage / 100) * 360;
    if (sweep > 0) {
      segments.push({
        startAngle: currentAngle,
        sweepAngle: sweep,
        color: item.color,
      });
      currentAngle += sweep;
    }
  }
  return segments;
}

interface HalfCircleSegmentProps {
  size: number;
  startAngle: number;
  sweepAngle: number;
  color: string;
}

function HalfCircleSegment({
  size,
  startAngle,
  sweepAngle,
  color,
}: HalfCircleSegmentProps) {
  // For segments <= 180°, render one rotated half-circle.
  // For segments > 180°, render two halves.
  if (sweepAngle <= 0) return null;

  if (sweepAngle <= 180) {
    return (
      <SingleArc
        size={size}
        startAngle={startAngle}
        sweepAngle={sweepAngle}
        color={color}
      />
    );
  }

  // Split into two arcs
  return (
    <>
      <SingleArc
        size={size}
        startAngle={startAngle}
        sweepAngle={180}
        color={color}
      />
      <SingleArc
        size={size}
        startAngle={startAngle + 180}
        sweepAngle={sweepAngle - 180}
        color={color}
      />
    </>
  );
}

interface SingleArcProps {
  size: number;
  startAngle: number;
  sweepAngle: number;
  color: string;
}

function SingleArc({ size, startAngle, sweepAngle, color }: SingleArcProps) {
  // Renders a colored half-circle rotated to the correct position.
  // The half-circle is clipped by a container that only shows the sweep portion.
  const half = size / 2;

  return (
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        transform: [{ rotate: `${startAngle}deg` }],
      }}
    >
      {/* Clip container: only shows the right half */}
      <View
        style={{
          position: "absolute",
          width: half,
          height: size,
          left: half,
          overflow: "hidden",
        }}
      >
        {/* The colored half-circle, rotated by sweepAngle */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: half,
            backgroundColor: color,
            transform: [
              { translateX: -half },
              { rotate: `${sweepAngle}deg` },
              { translateX: half },
            ],
          }}
        />
      </View>
    </View>
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
