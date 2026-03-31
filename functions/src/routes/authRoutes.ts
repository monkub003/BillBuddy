import { Router, Request, Response } from "express";
import { createAuthService, AuthServiceDeps } from "../services/authService";

/**
 * Factory that creates the auth router.
 * Accepts optional AuthServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export function createAuthRouter(deps?: Partial<AuthServiceDeps>): Router {
  const router = Router();
  const authService = createAuthService(deps);

  // POST /auth/signup
  router.post("/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.signup(email, password);

    if (result.error) {
      const status = result.error === "invalid credentials" ? 401 : 400;
      res.status(status).json(result);
      return;
    }

    res.status(200).json(result);
  });

  // POST /auth/login
  router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    if (result.error) {
      const status = result.error === "invalid credentials" ? 401 : 400;
      res.status(status).json(result);
      return;
    }

    res.status(200).json(result);
  });

  return router;
}
