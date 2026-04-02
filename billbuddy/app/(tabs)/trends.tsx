import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Theme } from "@/constants/theme";
import { useTrends, MonthlyTotal, AiInsight } from "@/hooks/useTrends";
import { useExpenseStore } from "@/store/expenseStore";

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const INSIGHT_ICONS: Record<AiInsight["type"], string> = {
  warning: "⚠️",
  info: "📊",
  suggestion: "💡",
};

const INSIGHT_BAR_COLORS: Record<AiInsight["type"], string> = {
  warning: Theme.status.warning,
  info: Theme.status.critical,
  suggestion: Theme.accent.green,
};

// ─── Mini Line Chart (pure RN, no library) ──────────────────

interface MiniLineChartProps {
  data: MonthlyTotal[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

function MiniLineChart({ data, selectedIndex, onSelect }: MiniLineChartProps) {
  const CHART_W = 300;
  const CHART_H = 120;
  const PADDING_X = 10;
  const PADDING_TOP = 20;
  const PADDING_BOTTOM = 4;

  const amounts = data.map((d) => d.amount);
  const maxVal = Math.max(...amounts, 1);
  const minVal = Math.min(...amounts, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: PADDING_X + (i / (data.length - 1)) * (CHART_W - PADDING_X * 2),
    y: PADDING_TOP + (1 - (d.amount - minVal) / range) * (CHART_H - PADDING_TOP - PADDING_BOTTOM),
  }));

  // Find the split index between historical and forecast
  const forecastStart = data.findIndex((d) => d.isForecast);

  return (
    <View style={chartStyles.container}>
      <View style={{ width: CHART_W, height: CHART_H }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((frac) => {
          const y = PADDING_TOP + frac * (CHART_H - PADDING_TOP - PADDING_BOTTOM);
          return (
            <View
              key={frac}
              style={[chartStyles.gridLine, { top: y }]}
            />
          );
        })}

        {/* Line segments */}
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const isForecastSegment = i >= forecastStart && forecastStart > 0;

          return (
            <View
              key={`line-${i}`}
              style={[
                chartStyles.lineSegment,
                {
                  left: prev.x,
                  top: prev.y,
                  width: length,
                  transform: [{ rotate: `${angle}deg` }],
                  borderStyle: isForecastSegment ? "dashed" : "solid",
                  opacity: isForecastSegment ? 0.6 : 1,
                },
              ]}
            />
          );
        })}

        {/* Dots */}
        {points.map((pt, i) => (
          <View
            key={`dot-${i}`}
            style={[
              chartStyles.dot,
              {
                left: pt.x - 4,
                top: pt.y - 4,
                backgroundColor: data[i].isForecast
                  ? "rgba(15,157,88,0.4)"
                  : Theme.accent.green,
              },
            ]}
          />
        ))}

        {/* Tooltip */}
        {selectedIndex != null && points[selectedIndex] && (
          <View
            style={[
              chartStyles.tooltip,
              {
                left: Math.min(points[selectedIndex].x - 40, CHART_W - 100),
                top: Math.max(points[selectedIndex].y - 50, 0),
              },
            ]}
          >
            <Text style={chartStyles.tooltipMonth}>
              {data[selectedIndex].month}
            </Text>
            <Text style={chartStyles.tooltipAmount}>
              : {formatCurrency(data[selectedIndex].amount)}
            </Text>
          </View>
        )}
      </View>

      {/* X-axis labels */}
      <View style={chartStyles.xLabels}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={[
              chartStyles.xLabel,
              d.isForecast && chartStyles.xLabelForecast,
            ]}
            onPress={() => onSelect(selectedIndex === i ? null : i)}
          >
            {d.month}
          </Text>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },
  gridLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  lineSegment: {
    position: "absolute",
    height: 0,
    borderTopWidth: 2.5,
    borderTopColor: Theme.accent.green,
    transformOrigin: "left center",
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: Theme.background.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tooltipMonth: {
    fontSize: 12,
    color: Theme.text.secondary,
  },
  tooltipAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.accent.green,
    marginLeft: 2,
  },
  xLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 300,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  xLabel: {
    fontSize: 11,
    color: Theme.text.secondary,
    textAlign: "center",
  },
  xLabelForecast: {
    color: Theme.text.muted,
    fontStyle: "italic",
  },
});

// ─── Insight Card ───────────────────────────────────────────

function InsightCard({ insight }: { insight: AiInsight }) {
  const barColor = INSIGHT_BAR_COLORS[insight.type];
  const icon = INSIGHT_ICONS[insight.type];

  return (
    <View style={insightStyles.card}>
      <View style={insightStyles.header}>
        <Text style={insightStyles.icon}>{icon}</Text>
        <View style={insightStyles.textContainer}>
          <Text style={insightStyles.title}>{insight.title}</Text>
          <Text style={insightStyles.description}>{insight.description}</Text>
        </View>
      </View>
      <View style={insightStyles.barRow}>
        <View style={insightStyles.barTrack}>
          <View
            style={[
              insightStyles.barFill,
              { width: `${insight.confidence}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={insightStyles.confidence}>{insight.confidence}%</Text>
      </View>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  card: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  icon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Theme.text.secondary,
    lineHeight: 18,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  confidence: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.text.secondary,
    minWidth: 36,
    textAlign: "right",
  },
});

// ─── Main Screen ────────────────────────────────────────────

export default function TrendsScreen() {
  const insets = useSafeAreaInsets();
  const { monthlyTotals, insights, loading, error, fetchTrends } = useTrends();
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const loadData = useCallback(() => {
    fetchExpenses({ month: currentMonth, year: currentYear });
    fetchTrends();
  }, [fetchExpenses, fetchTrends, currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading && monthlyTotals.every((m) => m.amount === 0)) {
    return (
      <View style={[screenStyles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.accent.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[screenStyles.container, { paddingTop: insets.top }]}
      contentContainerStyle={screenStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadData}
          tintColor={Theme.accent.green}
        />
      }
    >
      <Text style={screenStyles.pageTitle}>วิเคราะห์แนวโน้ม</Text>

      {error && (
        <View style={screenStyles.errorBanner}>
          <Text style={screenStyles.errorText}>{error}</Text>
        </View>
      )}

      {/* Trend Chart Card */}
      <View style={screenStyles.chartCard}>
        <Text style={screenStyles.chartTitle}>
          แนวโน้มค่าใช้จ่าย 6 เดือน + คาดการณ์
        </Text>
        <Text style={screenStyles.chartSubtitle}>
          เส้นประ = คาดการณ์โดย AI
        </Text>
        <MiniLineChart
          data={monthlyTotals}
          selectedIndex={selectedPoint}
          onSelect={setSelectedPoint}
        />
      </View>

      {/* AI Insights */}
      <Text style={screenStyles.sectionTitle}>AI Insights</Text>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginBottom: 20,
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
  chartCard: {
    backgroundColor: Theme.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.text.primary,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: Theme.text.secondary,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.text.primary,
    marginBottom: 14,
  },
});
