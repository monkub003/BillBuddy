import { Router } from "express";
import { PredictionEngineDeps } from "../services/predictionEngine";
/**
 * Factory that creates the prediction router.
 * Accepts optional PredictionEngineDeps so callers can inject custom stores/clients
 * (e.g. in-memory for tests, real Firestore + APIs in production).
 */
export declare function createPredictionRouter(deps?: Partial<PredictionEngineDeps>): Router;
//# sourceMappingURL=predictionRoutes.d.ts.map