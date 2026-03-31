"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incomeSchema = exports.expenseSchema = void 0;
exports.sanitizeString = sanitizeString;
exports.sanitizeObject = sanitizeObject;
exports.validateSchema = validateSchema;
exports.sanitizeBody = sanitizeBody;
exports.validateBody = validateBody;
// ── Helpers ──────────────────────────────────────────────────────────
const HTML_TAG_RE = /<[^>]*>/g;
/**
 * Strip HTML tags and trim whitespace from a string value.
 */
function sanitizeString(value) {
    if (typeof value !== "string")
        return "";
    return value.replace(HTML_TAG_RE, "").trim();
}
/**
 * Recursively sanitize all string values in a plain object / array.
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === "string")
        return sanitizeString(obj);
    if (typeof obj === "number" || typeof obj === "boolean")
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }
    if (typeof obj === "object") {
        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            result[key] = sanitizeObject(val);
        }
        return result;
    }
    return obj;
}
const ALLOWED_CATEGORIES = [
    "electricity",
    "water",
    "insurance",
    "loan",
    "gas",
    "manual",
];
const ALLOWED_SOURCES = [
    "email",
    "image",
    "manual",
];
// ── Schemas ──────────────────────────────────────────────────────────
exports.expenseSchema = {
    category: { type: "string", required: true, enum: ALLOWED_CATEGORIES },
    amount: { type: "number", required: true },
    dueDate: { type: "string", required: true },
    isPaid: { type: "boolean", required: true },
    extractedVia: { type: "string", required: true, enum: ALLOWED_SOURCES },
    rawSourceRef: { type: "string" },
};
exports.incomeSchema = {
    monthlyIncome: { type: "number", required: true },
};
// ── Validation logic ─────────────────────────────────────────────────
/**
 * Validate a request body against a schema.
 * Returns an array of error messages (empty = valid).
 */
function validateSchema(body, schema) {
    const errors = [];
    for (const [field, spec] of Object.entries(schema)) {
        const value = body[field];
        // Required check
        if (spec.required && (value === undefined || value === null || value === "")) {
            errors.push(`${field} is required`);
            continue;
        }
        // Skip optional absent fields
        if (value === undefined || value === null)
            continue;
        // Type check
        if (typeof value !== spec.type) {
            errors.push(`${field} must be of type ${spec.type}`);
            continue;
        }
        // Enum check
        if (spec.enum && !spec.enum.includes(value)) {
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
function sanitizeBody(req, _res, next) {
    if (req.body && typeof req.body === "object") {
        req.body = sanitizeObject(req.body);
    }
    next();
}
/**
 * Factory that returns middleware validating `req.body` against the
 * given schema. Responds with 400 on validation failure.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const errors = validateSchema(req.body ?? {}, schema);
        if (errors.length > 0) {
            res.status(400).json({ data: null, error: errors.join("; ") });
            return;
        }
        next();
    };
}
//# sourceMappingURL=inputSanitizer.js.map