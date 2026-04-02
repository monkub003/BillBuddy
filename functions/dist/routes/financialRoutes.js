"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFinancialRouter = createFinancialRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const financialPlanner_1 = require("../services/financialPlanner");
function createFinancialRouter(deps) {
    const router = (0, express_1.Router)();
    const { expenseStore, userStore, budgetStore } = deps;
    const financialPlanner = (0, financialPlanner_1.createFinancialPlanner)({ expenseStore, userStore, budgetStore });
    router.use(authMiddleware_1.authMiddleware);
    // GET /financial/ratio-history — expense-to-income ratio for past N months
    router.get("/ratio-history", async (req, res) => {
        const userId = req.userId;
        const months = req.query.months ? parseInt(req.query.months, 10) : 6;
        try {
            const history = await financialPlanner.getExpenseRatioHistory(userId, months);
            res.status(200).json({ data: history, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // GET /financial/forecast — forecast expenses for N months ahead
    router.get("/forecast", async (req, res) => {
        const userId = req.userId;
        const months = req.query.months ? parseInt(req.query.months, 10) : 3;
        try {
            const forecast = await financialPlanner.forecastExpenses(userId, months);
            res.status(200).json({ data: forecast, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // GET /financial/suggestions — cost reduction suggestions
    router.get("/suggestions", async (req, res) => {
        const userId = req.userId;
        try {
            const suggestions = await financialPlanner.suggestCostReduction(userId);
            res.status(200).json({ data: suggestions, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    return router;
}
//# sourceMappingURL=financialRoutes.js.map