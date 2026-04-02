import { Router, Request, Response } from "express";
import { createAiInsightService, AiInsightServiceDeps } from "../services/aiInsightService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

export function createInsightRouter(deps?: Partial<AiInsightServiceDeps>): Router {
  const router = Router();
  const insightService = createAiInsightService(deps);

  router.use(authMiddleware);

  // GET /insights — generate AI-powered insights for the authenticated user
  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const insights = await insightService.generateInsights(userId);
      res.status(200).json({ data: insights, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  return router;
}
