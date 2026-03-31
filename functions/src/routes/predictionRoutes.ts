import { Router, Request, Response } from "express";
import {
  createPredictionEngine,
  PredictionEngineDeps,
} from "../services/predictionEngine";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Factory that creates the prediction router.
 * Accepts optional PredictionEngineDeps so callers can inject custom stores/clients
 * (e.g. in-memory for tests, real Firestore + APIs in production).
 */
export function createPredictionRouter(deps?: Partial<PredictionEngineDeps>): Router {
  const router = Router();
  const predictionEngine = createPredictionEngine(deps);

  // All prediction routes require authentication
  router.use(authMiddleware);

  // GET /predictions — generate predictions for the authenticated user
  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const result = await predictionEngine.generatePredictions(userId);

      if (result.error) {
        // Insufficient data is a 200 with error message (not a server error)
        res.status(200).json(result);
        return;
      }

      res.status(200).json(result);
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  return router;
}
