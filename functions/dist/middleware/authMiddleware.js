"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not configured");
    return secret;
}
/**
 * JWT authentication middleware.
 *
 * - Extracts the token from the Authorization header ("Bearer <token>")
 * - Verifies the token signature and expiration
 * - Attaches `userId` to the request object
 * - Returns 401 for missing, invalid, or expired tokens
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ data: null, error: "unauthorized" });
        return;
    }
    const token = authHeader.slice(7); // strip "Bearer "
    if (!token) {
        res.status(401).json({ data: null, error: "unauthorized" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, getJwtSecret());
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({ data: null, error: "unauthorized" });
    }
}
//# sourceMappingURL=authMiddleware.js.map