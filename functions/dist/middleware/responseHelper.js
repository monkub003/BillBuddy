"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.mapErrorToStatus = mapErrorToStatus;
exports.errorHandlerMiddleware = errorHandlerMiddleware;
/**
 * Wraps a successful payload in the standard { data, error } envelope.
 */
function successResponse(data) {
    return { data, error: null };
}
/**
 * Wraps an error message in the standard { data, error } envelope.
 */
function errorResponse(error) {
    return { data: null, error };
}
/**
 * Known application error with an associated HTTP status code.
 */
class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
/**
 * Maps well-known error message strings to HTTP status codes.
 */
function mapErrorToStatus(error) {
    switch (error) {
        // 400 — Validation errors
        case "amount must be positive":
        case "invalid category":
        case "invalid due date":
        case "invalid email":
        case "password too short":
        case "email already registered":
        case "income must be positive":
            return 400;
        // 401 — Authentication errors
        case "invalid credentials":
        case "unauthorized":
            return 401;
        // 403 — Authorization errors
        case "access denied":
            return 403;
        // 500 — Everything else
        default:
            return 500;
    }
}
/**
 * Express error-handling middleware.
 * Catches errors thrown by route handlers and returns a standardised
 * { data: null, error } envelope with the appropriate HTTP status code.
 */
function errorHandlerMiddleware(err, _req, res, _next) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json(errorResponse(err.message));
        return;
    }
    // Fallback: unexpected errors → 500
    const message = err.message || "internal server error";
    const status = mapErrorToStatus(message);
    res.status(status).json(errorResponse(message));
}
//# sourceMappingURL=responseHelper.js.map