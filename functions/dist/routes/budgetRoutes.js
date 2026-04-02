"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBudgetRouter = createBudgetRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const financialPlanner_1 = require("../services/financialPlanner");
function createBudgetRouter(deps) {
    const router = (0, express_1.Router)();
    const { expenseStore, userStore, budgetStore } = deps;
    const financialPlanner = (0, financialPlanner_1.createFinancialPlanner)({ expenseStore, userStore, budgetStore });
    router.use(authMiddleware_1.authMiddleware);
    // GET /budgets — get current budget plan for the authenticated user
    router.get("/", async (req, res) => {
        const userId = req.userId;
        try {
            const plan = await financialPlanner.generateBudgetPlan(userId);
            res.status(200).json({ data: plan, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // POST /budgets — generate a budget plan (optionally with savings goal)
    router.post("/", async (req, res) => {
        const userId = req.userId;
        const { savingsGoal } = req.body;
        try {
            let plan;
            if (typeof savingsGoal === "number" && savingsGoal > 0) {
                plan = await financialPlanner.calculateBudgetFromSavingsGoal(userId, savingsGoal);
            }
            else {
                plan = await financialPlanner.generateBudgetPlan(userId);
            }
            res.status(200).json({ data: plan, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // PUT /budgets — update budget with savings goal
    router.put("/", async (req, res) => {
        const userId = req.userId;
        const { savingsGoal } = req.body;
        if (typeof savingsGoal !== "number" || savingsGoal < 0) {
            res.status(400).json({ data: null, error: "savingsGoal must be a non-negative number" });
            return;
        }
        try {
            const plan = await financialPlanner.calculateBudgetFromSavingsGoal(userId, savingsGoal);
            res.status(200).json({ data: plan, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    return router;
}
//# sourceMappingURL=budgetRoutes.js.map