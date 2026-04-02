"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPredictionRouter = createPredictionRouter;
const express_1 = require("express");
const predictionEngine_1 = require("../services/predictionEngine");
const authMiddleware_1 = require("../middleware/authMiddleware");
/**
 * Factory that creates the prediction router.
 * Accepts optional PredictionEngineDeps so callers can inject custom stores/clients
 * (e.g. in-memory for tests, real Firestore + APIs in production).
 */
function createPredictionRouter(deps) {
    const router = (0, express_1.Router)();
    const predictionEngine = (0, predictionEngine_1.createPredictionEngine)(deps);
    // All prediction routes require authentication
    router.use(authMiddleware_1.authMiddleware);
    // GET /predictions — generate predictions for the authenticated user
    router.get("/", async (req, res) => {
        const userId = req.userId;
        try {
            const result = await predictionEngine.generatePredictions(userId);
            if (result.error) {
                // Insufficient data is a 200 with error message (not a server error)
                res.status(200).json(result);
                return;
            }
            res.status(200).json(result);
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    return router;
}
//# sourceMappingURL=predictionRoutes.js.map