import { Request, Response, NextFunction } from "express";
import { ExpenseCategory, ExtractionSource } from "../types/api";

// ── Helpers ──────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;

/**
 * Strip HTML tags and trim whitespace from a string value.
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(HTML_TAG_RE, "").trim();
}

/**
 * Recursively sanitize all string values in a plain object / array.
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeObject(val);
    }
    return result;
  }

  return obj;
}

// ── Schema validation types ──────────────────────────────────────────

interface FieldSpec {
  type: "string" | "number" | "boolean";
  required?: boolean;
  enum?: readonly string[];
}

type Schema = Record<string, FieldSpec>;

const ALLOWED_CATEGORIES: readonly string[] = [
  "electricity",
  "water",
  "insurance",
  "loan",
  "gas",
  "food",
  "transport",
  "household",
  "entertainment",
  "health",
  "education",
  "manual",
] satisfies readonly ExpenseCategory[];

const ALLOWED_SOURCES: readonly string[] = [
  "email",
  "image",
  "manual",
] satisfies readonly ExtractionSource[];

// ── Schemas ──────────────────────────────────────────────────────────

export const expenseSchema: Schema = {
  category: { type: "string", required: true, enum: ALLOWED_CATEGORIES },
  amount: { type: "number", required: true },
  dueDate: { type: "string", required: true },
  isPaid: { type: "boolean", required: true },
  extractedVia: { type: "string", required: true, enum: ALLOWED_SOURCES },
  rawSourceRef: { type: "string" },
};

export const incomeSchema: Schema = {
  monthlyIncome: { type: "number", required: true },
};

// ── Validation logic ─────────────────────────────────────────────────

/**
 * Validate a request body against a schema.
 * Returns an array of error messages (empty = valid).
 */
export function validateSchema(
  body: Record<string, unknown>,
  schema: Schema
): string[] {
  const errors: string[] = [];

  for (const [field, spec] of Object.entries(schema)) {
    const value = body[field];

    // Required check
    if (spec.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip optional absent fields
    if (value === undefined || value === null) continue;

    // Type check
    if (typeof value !== spec.type) {
      errors.push(`${field} must be of type ${spec.type}`);
      continue;
    }

    // Enum check
    if (spec.enum && !spec.enum.includes(value as string)) {
      errors.push(`${field} must be one of: ${spec.enum.join(", ")}`);
    }
  }

  return errors;
}

// ── Express middleware factories ─────────────────────────────────────

/**
 * Middleware that sanitizes all string values in `req.body`
 * (strips HTML tags, trims whitespace).
 */
export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Factory that returns middleware validating `req.body` against the
 * given schema. Responds with 400 on validation failure.
 */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors = validateSchema(req.body ?? {}, schema);
    if (errors.length > 0) {
      res.status(400).json({ data: null, error: errors.join("; ") });
      return;
    }
    next();
  };
}
