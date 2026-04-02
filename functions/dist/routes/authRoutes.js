"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const authService_1 = require("../services/authService");
/**
 * Factory that creates the auth router.
 * Accepts optional AuthServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
function createAuthRouter(deps) {
    const router = (0, express_1.Router)();
    const authService = (0, authService_1.createAuthService)(deps);
    // POST /auth/signup
    router.post("/signup", async (req, res) => {
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
    router.post("/login", async (req, res) => {
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
//# sourceMappingURL=authRoutes.js.map