"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardService = createDashboardService;
const firestore_1 = require("./firestore");
const financialPlanner_1 = require("./financialPlanner");
// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------
function createDashboardService(deps) {
    const expenseStore = deps?.expenseStore ?? (0, firestore_1.createInMemoryStore)();
    const userStore = deps?.userStore ?? (0, firestore_1.createInMemoryStore)();
    const financialPlanner = (0, financialPlanner_1.createFinancialPlanner)({ expenseStore, userStore });
    /**
     * Returns aggregated dashboard data for a user.
     *
     * @param userId  – authenticated user id
     * @param month   – optional target month as "YYYY-MM" (defaults to current month)
     */
    async function getDashboardData(userId, month) {
        const allExpenses = await expenseStore.findAllBy("userId", userId);
        // Determine target month
        const targetMonth = month ?? currentMonth();
        const [targetYear, targetMon] = targetMonth.split("-").map(Number);
        // --- Monthly total & category breakdown (for the target month) ---
        const monthExpenses = allExpenses.filter((e) => {
            const d = new Date(e.dueDate);
            return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMon;
        });
        const monthlyTotal = roundTwo(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
        // Group by category
        const categoryMap = new Map();
        for (const e of monthExpenses) {
            categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
        }
        const categoryBreakdown = [];
        for (const [category, amount] of categoryMap.entries()) {
            const rounded = roundTwo(amount);
            categoryBreakdown.push({
                category,
                amount: rounded,
                percentage: monthlyTotal > 0 ? roundTwo((rounded / monthlyTotal) * 100) : 0,
            });
        }
        // Sort by amount descending for consistent output
        categoryBreakdown.sort((a, b) => b.amount - a.amount);
        // --- Monthly history (last 6 months ending at target month) ---
        const monthlyHistory = [];
        for (let i = 5; i >= 0; i--) {
            const { year, mon } = subtractMonths(targetYear, targetMon, i);
            const key = formatMonth(year, mon);
            const total = roundTwo(allExpenses
                .filter((e) => {
                const d = new Date(e.dueDate);
                return d.getFullYear() === year && d.getMonth() + 1 === mon;
            })
                .reduce((sum, e) => sum + e.amount, 0));
            monthlyHistory.push({ month: key, total });
        }
        // --- Expense-to-income ratio (Req 3.4, 6.5) ---
        let expenseRatio = null;
        try {
            const ratioResult = await financialPlanner.calculateExpenseRatio(userId, targetMonth);
            // When monthlyIncome is null (skipped), set to null so the UI hides the card
            expenseRatio = ratioResult.skipped ? null : ratioResult;
        }
        catch {
            // Non-critical — dashboard still works without ratio
            expenseRatio = null;
        }
        return {
            data: { monthlyTotal, categoryBreakdown, monthlyHistory, expenseRatio },
            error: null,
        };
    }
    /**
     * Returns all expenses for a user filtered by category.
     */
    async function getExpensesByCategory(userId, category) {
        const allExpenses = await expenseStore.findAllBy("userId", userId);
        const filtered = allExpenses.filter((e) => e.category === category);
        return { data: filtered, error: null };
    }
    return { getDashboardData, getExpensesByCategory, _expenseStore: expenseStore };
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function currentMonth() {
    const now = new Date();
    return formatMonth(now.getFullYear(), now.getMonth() + 1);
}
function formatMonth(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`;
}
function subtractMonths(year, month, n) {
    let y = year;
    let m = month - n;
    while (m <= 0) {
        m += 12;
        y -= 1;
    }
    return { year: y, mon: m };
}
function roundTwo(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=dashboardService.js.map