import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/api";
/**
 * Wraps a successful payload in the standard { data, error } envelope.
 */
export declare function successResponse<T>(data: T): ApiResponse<T>;
/**
 * Wraps an error message in the standard { data, error } envelope.
 */
export declare function errorResponse(error: string): ApiResponse<null>;
/**
 * Known application error with an associated HTTP status code.
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}
/**
 * Maps well-known error message strings to HTTP status codes.
 */
export declare function mapErrorToStatus(error: string): number;
/**
 * Express error-handling middleware.
 * Catches errors thrown by route handlers and returns a standardised
 * { data: null, error } envelope with the appropriate HTTP status code.
 */
export declare function errorHandlerMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=responseHelper.d.ts.map