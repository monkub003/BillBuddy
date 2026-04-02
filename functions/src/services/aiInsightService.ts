import { Expense } from "../types/expense";
import { ExpenseCategory } from "../types/api";
import { FirestoreStore, createInMemoryStore } from "./firestore";

// ─── Types ──────────────────────────────────────────────────

export interface AiInsight {
  id: string;
  type: "warning" | "info" | "suggestion";
  title: string;
  description: string;
  confidence: number; // 0-100
}

export interface AiInsightServiceDeps {
  expenseStore: FirestoreStore<Expense>;
  aiApiKey?: string;
}

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

// ─── Service ────────────────────────────────────────────────

export function createAiInsightService(deps?: Partial<AiInsightServiceDeps>) {
  const expenseStore = deps?.expenseStore ?? createInMemoryStore<Expense>();
  const apiKey = deps?.aiApiKey ?? process.env.AI_SERVICE_API_KEY;

  /**
   * Summarize user expenses into a compact text block for the AI prompt.
   */
  function summarizeExpenses(expenses: Expense[]): string {
    // Group by category with totals
    const byCategory = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const e of expenses) {
      const entry = byCategory.get(e.category) ?? { total: 0, count: 0 };
      entry.total += e.amount;
      entry.count += 1;
      byCategory.set(e.category, entry);
    }

    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const lines: string[] = [`Total expenses: ฿${grandTotal.toLocaleString()}`];

    for (const [cat, data] of byCategory) {
      const label = CATEGORY_LABELS[cat] ?? cat;
      const pct = grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : "0";
      lines.push(`- ${label}: ฿${data.total.toLocaleString()} (${pct}%, ${data.count} transactions)`);
    }

    // Monthly trend (last 3 months)
    const monthlyTotals = new Map<string, number>();
    for (const e of expenses) {
      const d = new Date(e.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + e.amount);
    }
    const sortedMonths = Array.from(monthlyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sortedMonths.length > 0) {
      lines.push("\nMonthly totals:");
      for (const [month, total] of sortedMonths.slice(-3)) {
        lines.push(`- ${month}: ฿${total.toLocaleString()}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Call OpenAI API to generate insights from expense data.
   */
  async function callOpenAI(summary: string): Promise<AiInsight[]> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are a Thai financial advisor AI for the BillBuddy expense tracking app.
Analyze the user's expense data and return exactly 3 insights as a JSON array.
Each insight must have:
- "type": one of "warning", "info", or "suggestion"
- "title": short Thai title (max 40 chars)
- "description": one-line Thai description (max 60 chars)
- "confidence": number 0-100

Return ONLY the JSON array, no markdown, no explanation.
Example: [{"type":"warning","title":"ค่าไฟอาจเพิ่มขึ้น","description":"จากแนวโน้มการใช้จ่ายที่สูงขึ้น","confidence":78}]`,
          },
          {
            role: "user",
            content: `Analyze this expense data and provide 3 financial insights in Thai:\n\n${summary}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) throw new Error("AI response is not an array");

    return parsed.map((item: any, i: number) => ({
      id: `ai-${i}`,
      type: item.type === "warning" || item.type === "info" || item.type === "suggestion"
        ? item.type
        : "info",
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      confidence: Math.min(100, Math.max(0, Number(item.confidence) || 70)),
    }));
  }

  /**
   * Generate AI insights for a user's expenses.
   * Falls back to rule-based insights if AI is unavailable.
   */
  async function generateInsights(userId: string): Promise<AiInsight[]> {
    const all = await expenseStore.getAll();
    const userExpenses = all.filter((e) => e.userId === userId);

    if (userExpenses.length === 0) {
      return [{
        id: "no-data",
        type: "info",
        title: "เริ่มบันทึกค่าใช้จ่าย",
        description: "เพิ่มรายการเพื่อรับคำแนะนำจาก AI",
        confidence: 100,
      }];
    }

    const summary = summarizeExpenses(userExpenses);

    // Try AI-powered insights first
    if (apiKey && apiKey !== "your_openai_or_custom_model_key") {
      try {
        return await callOpenAI(summary);
      } catch (err) {
        // Fall through to rule-based
        console.error("AI insight generation failed:", err);
      }
    }

    // Fallback: rule-based insights
    return generateRuleBasedInsights(userExpenses);
  }

  /**
   * Simple rule-based fallback when AI is not available.
   */
  function generateRuleBasedInsights(expenses: Expense[]): AiInsight[] {
    const insights: AiInsight[] = [];
    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

    // Group by category
    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }

    // Find highest spending category
    let maxCat: ExpenseCategory = "manual";
    let maxAmount = 0;
    for (const [cat, total] of byCategory) {
      if (total > maxAmount) {
        maxCat = cat;
        maxAmount = total;
      }
    }
    const maxPct = grandTotal > 0 ? Math.round((maxAmount / grandTotal) * 100) : 0;
    const maxLabel = CATEGORY_LABELS[maxCat] ?? maxCat;

    if (maxPct > 40) {
      insights.push({
        id: "high-category",
        type: "warning",
        title: `${maxLabel}สูงถึง ${maxPct}% ของค่าใช้จ่าย`,
        description: "ลองพิจารณาลดค่าใช้จ่ายในหมวดนี้",
        confidence: 85,
      });
    }

    // Monthly trend check
    const monthlyTotals = new Map<string, number>();
    for (const e of expenses) {
      const d = new Date(e.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + e.amount);
    }
    const months = Array.from(monthlyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (months.length >= 2) {
      const latest = months[months.length - 1][1];
      const prev = months[months.length - 2][1];
      const change = prev > 0 ? Math.round(((latest - prev) / prev) * 100) : 0;
      if (change > 10) {
        insights.push({
          id: "spending-up",
          type: "info",
          title: `ค่าใช้จ่ายเพิ่มขึ้น ${change}%`,
          description: "เทียบกับเดือนก่อนหน้า",
          confidence: 80,
        });
      } else if (change < -10) {
        insights.push({
          id: "spending-down",
          type: "suggestion",
          title: `ค่าใช้จ่ายลดลง ${Math.abs(change)}%`,
          description: "ทำได้ดีมาก ลดค่าใช้จ่ายได้ต่อเนื่อง",
          confidence: 80,
        });
      }
    }

    // Always add a general suggestion
    insights.push({
      id: "general-tip",
      type: "suggestion",
      title: "แนะนำ: ตั้งงบประมาณรายเดือน",
      description: "ช่วยควบคุมค่าใช้จ่ายได้ดีขึ้น",
      confidence: 90,
    });

    return insights.slice(0, 3);
  }

  return { generateInsights };
}
