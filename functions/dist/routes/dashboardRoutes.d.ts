import { Router } from "express";
import { DashboardServiceDeps } from "../services/dashboardService";
/**
 * Factory that creates the dashboard router.
 * Accepts optional DashboardServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export declare function createDashboardRouter(deps?: Partial<DashboardServiceDeps>): Router;
//# sourceMappingURL=dashboardRoutes.d.ts.map