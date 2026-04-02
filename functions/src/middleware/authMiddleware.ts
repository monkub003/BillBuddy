import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Extend Express Request to carry the authenticated userId.
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
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
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    (req as AuthenticatedRequest).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ data: null, error: "unauthorized" });
  }
}
