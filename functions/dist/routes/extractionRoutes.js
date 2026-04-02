"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExtractionRouter = createExtractionRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const aiClient_1 = require("../extractors/aiClient");
function createExtractionRouter() {
    const router = (0, express_1.Router)();
    router.use(authMiddleware_1.authMiddleware);
    // POST /extract — send base64 image, get back category + amount
    router.post("/", async (req, res) => {
        const { imageBase64, mimeType } = req.body;
        if (!imageBase64) {
            res.status(400).json({ data: null, error: "imageBase64 is required" });
            return;
        }
        try {
            const aiClient = (0, aiClient_1.createAIClient)();
            const result = await aiClient.extractFromBase64(imageBase64, mimeType || "image/jpeg");
            res.status(200).json({ data: result, error: null });
        }
        catch (err) {
            console.error("Extraction failed:", err);
            res.status(200).json({
                data: {
                    amount: { value: 0, confidence: 0 },
                    category: { value: "manual", confidence: 0 },
                    dueDate: { value: new Date().toISOString().slice(0, 10), confidence: 0 },
                },
                error: "ไม่สามารถสกัดข้อมูลจากรูปได้ กรุณาลองใหม่หรือกรอกข้อมูลเอง",
            });
        }
    });
    return router;
}
//# sourceMappingURL=extractionRoutes.js.map