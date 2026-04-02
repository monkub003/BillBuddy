import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createAIClient } from "../extractors/aiClient";

export function createExtractionRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // POST /extract — send base64 image, get back category + amount
  router.post("/", async (req: Request, res: Response) => {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      res.status(400).json({ data: null, error: "imageBase64 is required" });
      return;
    }

    try {
      const aiClient = createAIClient();
      const result = await aiClient.extractFromBase64(
        imageBase64,
        mimeType || "image/jpeg"
      );

      res.status(200).json({ data: result, error: null });
    } catch (err) {
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
