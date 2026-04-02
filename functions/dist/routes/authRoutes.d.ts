import { Router } from "express";
import { AuthServiceDeps } from "../services/authService";
/**
 * Factory that creates the auth router.
 * Accepts optional AuthServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export declare function createAuthRouter(deps?: Partial<AuthServiceDeps>): Router;
//# sourceMappingURL=authRoutes.d.ts.map