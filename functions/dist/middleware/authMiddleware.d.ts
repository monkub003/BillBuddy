import { Request, Response, NextFunction } from "express";
/**
 * Extend Express Request to carry the authenticated userId.
 */
export interface AuthenticatedRequest extends Request {
    userId: string;
}
/**
 * JWT authentication middleware.
 *
 * - Extracts the token from the Authorization header ("Bearer <token>")
 * - Verifies the token signature and expiration
 * - Attaches `userId` to the request object
 * - Returns 401 for missing, invalid, or expired tokens
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=authMiddleware.d.ts.map