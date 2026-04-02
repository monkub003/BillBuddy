"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardRouter = createDashboardRouter;
const express_1 = require("express");
const dashboardService_1 = require("../services/dashboardService");
const authMiddleware_1 = require("../middleware/authMiddleware");
/**
 * Factory that creates the dashboard router.
 * Accepts optional DashboardServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
function createDashboardRouter(deps) {
    const router = (0, express_1.Router)();
    const dashboardService = (0, dashboardService_1.createDashboardService)(deps);
    // All dashboard routes require authentication
    router.use(authMiddleware_1.authMiddleware);
    // GET /dashboard — aggregated dashboard data
    router.get("/", async (req, res) => {
        const userId = req.userId;
        const month = req.query.month;
        try {
            const result = await dashboardService.getDashboardData(userId, month);
            res.status(200).json(result);
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // GET /dashboard/category/:category — expenses filtered by category
    router.get("/category/:category", async (req, res) => {
        const userId = req.userId;
        const category = req.params.category;
        const validCategories = [
            "electricity", "water", "insurance", "loan", "gas", "manual",
        ];
        if (!validCategories.includes(category)) {
            res.status(400).json({ data: null, error: "invalid category" });
            return;
        }
        try {
            const result = await dashboardService.getExpensesByCategory(userId, category);
            res.status(200).json(result);
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    return router;
}
//# sourceMappingURL=dashboardRoutes.js.map