import { Request, Response, NextFunction } from "express";
/**
 * Strip HTML tags and trim whitespace from a string value.
 */
export declare function sanitizeString(value: unknown): string;
/**
 * Recursively sanitize all string values in a plain object / array.
 */
export declare function sanitizeObject(obj: unknown): unknown;
interface FieldSpec {
    type: "string" | "number" | "boolean";
    required?: boolean;
    enum?: readonly string[];
}
type Schema = Record<string, FieldSpec>;
export declare const expenseSchema: Schema;
export declare const incomeSchema: Schema;
/**
 * Validate a request body against a schema.
 * Returns an array of error messages (empty = valid).
 */
export declare function validateSchema(body: Record<string, unknown>, schema: Schema): string[];
/**
 * Middleware that sanitizes all string values in `req.body`
 * (strips HTML tags, trims whitespace).
 */
export declare function sanitizeBody(req: Request, _res: Response, next: NextFunction): void;
/**
 * Factory that returns middleware validating `req.body` against the
 * given schema. Responds with 400 on validation failure.
 */
export declare function validateBody(schema: Schema): (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=inputSanitizer.d.ts.map