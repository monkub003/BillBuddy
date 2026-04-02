import { Request, Response } from "express";
import {
  sanitizeString,
  sanitizeObject,
  validateSchema,
  sanitizeBody,
  validateBody,
  expenseSchema,
  incomeSchema,
} from "../../src/middleware/inputSanitizer";

// ── sanitizeString ───────────────────────────────────────────────────

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<b>bold</b>")).toBe("bold");
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("handles non-string input", () => {
    expect(sanitizeString(42)).toBe("");
    expect(sanitizeString(null)).toBe("");
    expect(sanitizeString(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeString("")).toBe("");
  });
});

// ── sanitizeObject ───────────────────────────────────────────────────

describe("sanitizeObject", () => {
  it("recursively sanitizes nested strings", () => {
    const input = { name: "<b>Test</b>", nested: { val: "  hi  " } };
    expect(sanitizeObject(input)).toEqual({ name: "Test", nested: { val: "hi" } });
  });

  it("preserves numbers and booleans", () => {
    expect(sanitizeObject({ n: 42, b: true })).toEqual({ n: 42, b: true });
  });

  it("sanitizes arrays", () => {
    expect(sanitizeObject(["<i>a</i>", " b "])).toEqual(["a", "b"]);
  });

  it("handles null and undefined", () => {
    expect(sanitizeObject(null)).toBeNull();
    expect(sanitizeObject(undefined)).toBeUndefined();
  });
});

// ── validateSchema ───────────────────────────────────────────────────

describe("validateSchema", () => {
  it("returns no errors for a valid expense body", () => {
    const body = {
      category: "electricity",
      amount: 100,
      dueDate: "2025-01-15",
      isPaid: false,
      extractedVia: "manual",
    };
    expect(validateSchema(body, expenseSchema)).toEqual([]);
  });

  it("reports missing required fields", () => {
    const errors = validateSchema({}, expenseSchema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("category is required"))).toBe(true);
    expect(errors.some((e) => e.includes("amount is required"))).toBe(true);
  });

  it("reports wrong types", () => {
    const body = { category: 123, amount: "abc", dueDate: "2025-01-15", isPaid: false, extractedVia: "manual" };
    const errors = validateSchema(body, expenseSchema);
    expect(errors.some((e) => e.includes("category must be of type string"))).toBe(true);
    expect(errors.some((e) => e.includes("amount must be of type number"))).toBe(true);
  });

  it("reports invalid enum values", () => {
    const body = { category: "invalid_cat", amount: 10, dueDate: "2025-01-15", isPaid: true, extractedVia: "manual" };
    const errors = validateSchema(body, expenseSchema);
    expect(errors.some((e) => e.includes("category must be one of"))).toBe(true);
  });

  it("validates income schema", () => {
    expect(validateSchema({ monthlyIncome: 50000 }, incomeSchema)).toEqual([]);
    const errors = validateSchema({}, incomeSchema);
    expect(errors.some((e) => e.includes("monthlyIncome is required"))).toBe(true);
  });

  it("skips optional absent fields", () => {
    const body = { category: "gas", amount: 50, dueDate: "2025-06-01", isPaid: true, extractedVia: "image" };
    // rawSourceRef is optional and absent — should be fine
    expect(validateSchema(body, expenseSchema)).toEqual([]);
  });
});

// ── sanitizeBody middleware ──────────────────────────────────────────

describe("sanitizeBody middleware", () => {
  it("sanitizes req.body strings and calls next", () => {
    const req = { body: { name: "<b>Test</b>", amount: 42 } } as unknown as Request;
    const next = jest.fn();
    sanitizeBody(req, {} as Response, next);
    expect(req.body.name).toBe("Test");
    expect(req.body.amount).toBe(42);
    expect(next).toHaveBeenCalled();
  });
});

// ── validateBody middleware ──────────────────────────────────────────

describe("validateBody middleware", () => {
  function createMockRes() {
    const data: { statusCode?: number; body?: unknown } = {};
    const res = {
      status(code: number) { data.statusCode = code; return res; },
      json(body: unknown) { data.body = body; return res; },
    } as unknown as Response;
    return { res, data };
  }

  it("calls next when body is valid", () => {
    const req = { body: { monthlyIncome: 30000 } } as unknown as Request;
    const { res } = createMockRes();
    const next = jest.fn();
    validateBody(incomeSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 400 when body is invalid", () => {
    const req = { body: {} } as unknown as Request;
    const { res, data } = createMockRes();
    const next = jest.fn();
    validateBody(incomeSchema)(req, res, next);
    expect(data.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
