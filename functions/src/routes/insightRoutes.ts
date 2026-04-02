import { Router, Request, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
import { createAIClient } from "../extractors/aiClient";

interface InsightRoutesDeps {
  expenseStore: FirestoreStore<Expense>;
}

interface Insight {
  id: string;
  type: "warning" | "info" | "suggestion";
  title: string;
  description: string;
  confidence: number;
}

const CATEGORY_LABELS: Record<string, string> = {
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

/**
 * Generate insights from expense data locally (no AI needed).
 */
function generateLocalInsights(
  userExpenses: Expense[],
  categoryTotals: Record<string, number>,
  monthlyTotals: Record<string, number>,
  totalSpent: number
): Insight[] {
  const insights: Insight[] = [];

  // 1. Find the highest spending category
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const [topCat, topAmt] = sortedCats[0];
    const pct = Math.round((topAmt / totalSpent) * 100);
    const label = CATEGORY_LABELS[topCat] || topCat;
    insights.push({
      id: "top-category",
      type: "warning",
      title: `${label} คือหมวดที่ใช้จ่ายสูงสุด (${pct}%)`,
      description: `คุณใช้จ่ายหมวด${label}รวม ฿${topAmt.toLocaleString()} คิดเป็น ${pct}% ของค่าใช้จ่ายทั้งหมด`,
      confidence: 95,
    });
  }

  // 2. Monthly trend analysis
  const months = Object.entries(monthlyTotals).sort();
  if (months.length >= 2) {
    const latest = months[months.length - 1];
    const prev = months[months.length - 2];
    const diff = latest[1] - prev[1];
    const pctChange = prev[1] > 0 ? Math.round((diff / prev[1]) * 100) : 0;

    if (diff > 0) {
      insights.push({
        id: "monthly-trend",
        type: "warning",
        title: `ค่าใช้จ่ายเพิ่มขึ้น ${pctChange}% จากเดือนก่อน`,
        description: `เดือน ${latest[0]} ใช้จ่าย ฿${latest[1].toLocaleString()} เทียบกับ ฿${prev[1].toLocaleString()} ในเดือน ${prev[0]}`,
        confidence: 90,
      });
    } else if (diff < 0) {
      insights.push({
        id: "monthly-trend",
        type: "info",
        title: `ค่าใช้จ่ายลดลง ${Math.abs(pctChange)}% จากเดือนก่อน`,
        description: `เดือน ${latest[0]} ใช้จ่าย ฿${latest[1].toLocaleString()} ลดลงจาก ฿${prev[1].toLocaleString()} ในเดือน ${prev[0]}`,
        confidence: 90,
      });
    }
  }

  // 3. Average per transaction
  const avgPerTx = Math.round(totalSpent / userExpenses.length);
  insights.push({
    id: "avg-transaction",
    type: "info",
    title: `ค่าใช้จ่ายเฉลี่ยต่อรายการ ฿${avgPerTx.toLocaleString()}`,
    description: `จากทั้งหมด ${userExpenses.length} รายการ รวม ฿${totalSpent.toLocaleString()}`,
    confidence: 95,
  });

  // 4. Suggestion based on category count
  if (sortedCats.length >= 2) {
    const [topCat] = sortedCats[0];
    const label = CATEGORY_LABELS[topCat] || topCat;
    insights.push({
      id: "saving-tip",
      type: "suggestion",
      title: `แนะนำ: ลองลดค่าใช้จ่ายหมวด${label}`,
      description: `หมวดนี้เป็นสัดส่วนใหญ่ที่สุด การลดลง 10% จะประหยัดได้ ฿${Math.round(sortedCats[0][1] * 0.1).toLocaleString()} ต่อเดือน`,
      confidence: 80,
    });
  }

  return insights;
}

export function createInsightRouter(deps: InsightRoutesDeps): Router {
  const router = Router();
  const { expenseStore } = deps;

  router.use(authMiddleware);

  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const all = await expenseStore.getAll();
      const userExpenses = all.filter((e) => e.userId === userId);

      if (userExpenses.length === 0) {
        res.status(200).json({
          data: { insights: [], message: "ยังไม่มีข้อมูลค่าใช้จ่าย" },
          error: null,
        });
        return;
      }

      const categoryTotals: Record<string, number> = {};
      const monthlyTotals: Record<string, number> = {};

      for (const e of userExpenses) {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
        const monthKey = e.dueDate.slice(0, 7);
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + e.amount;
      }

      const totalSpent = userExpenses.reduce((s, e) => s + e.amount, 0);

      // Try AI-powered insights first
      let insights: Insight[] | null = null;
      try {
        const aiClient = createAIClient();
        const prompt = `คุณเป็นที่ปรึกษาการเงินส่วนบุคคลสำหรับคนไทย วิเคราะห์ข้อมูลค่าใช้จ่ายต่อไปนี้และให้คำแนะนำ:

ยอดรวมทั้งหมด: ฿${totalSpent.toLocaleString()}
จำนวนรายการ: ${userExpenses.length}

ค่าใช้จ่ายตามหมวดหมู่:
${Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: ฿${amt.toLocaleString()}`).join("\n")}

ค่าใช้จ่ายรายเดือน:
${Object.entries(monthlyTotals).sort().map(([m, amt]) => `- ${m}: ฿${amt.toLocaleString()}`).join("\n")}

ตอบเป็น JSON array เท่านั้น ห้ามมี text อื่น รูปแบบ:
[{"type":"warning|info|suggestion","title":"หัวข้อสั้นๆ","description":"คำอธิบาย 1-2 ประโยค","confidence":0-100}]

ให้ 3-5 insights ที่เป็นประโยชน์`;

        const responseText = await aiClient.generateInsights(prompt);
        const cleaned = responseText.replace(/```json\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        insights = parsed.map((ins: any, i: number) => ({
          id: `ai-insight-${i}`,
          ...ins,
        }));
      } catch {
        // AI failed — fall through to local insights
      }

      // Fallback to local analysis if AI didn't work
      if (!insights || insights.length === 0) {
        insights = generateLocalInsights(userExpenses, categoryTotals, monthlyTotals, totalSpent);
      }

      res.status(200).json({ data: { insights }, error: null });
    } catch (err) {
      console.error("Insight generation failed:", err);
      res.status(200).json({
        data: { insights: [] },
        error: "ไม่สามารถสร้าง insights ได้ในขณะนี้",
      });
    }
  });

  return router;
}
