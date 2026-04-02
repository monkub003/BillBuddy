"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInsightRouter = createInsightRouter;
const express_1 = require("express");
const aiInsightService_1 = require("../services/aiInsightService");
const authMiddleware_1 = require("../middleware/authMiddleware");
function createInsightRouter(deps) {
    const router = (0, express_1.Router)();
    const insightService = (0, aiInsightService_1.createAiInsightService)(deps);
    router.use(authMiddleware_1.authMiddleware);
    // GET /insights — generate AI-powered insights for the authenticated user
    router.get("/", async (req, res) => {
        const userId = req.userId;
        try {
            const insights = await insightService.generateInsights(userId);
            res.status(200).json({ data: insights, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    return router;
}
//# sourceMappingURL=insightRoutes.js.map