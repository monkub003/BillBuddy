import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/api";

/**
 * Wraps a successful payload in the standard { data, error } envelope.
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

/**
 * Wraps an error message in the standard { data, error } envelope.
 */
export function errorResponse(error: string): ApiResponse<null> {
  return { data: null, error };
}

/**
 * Known application error with an associated HTTP status code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Maps well-known error message strings to HTTP status codes.
 */
export function mapErrorToStatus(error: string): number {
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
export function errorHandlerMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Fallback: unexpected errors → 500
  const message = err.message || "internal server error";
  const status = mapErrorToStatus(message);
  res.status(status).json(errorResponse(message));
}
