"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToExpense = mapToExpense;
exports.validateExpenseData = validateExpenseData;
exports.serializeExpense = serializeExpense;
exports.deserializeExpense = deserializeExpense;
const uuid_1 = require("uuid");
const ALLOWED_CATEGORIES = [
    "electricity",
    "water",
    "insurance",
    "loan",
    "gas",
    "manual",
];
/**
 * Maps raw AI extraction output to a valid Expense record.
 * Defaults unrecognized categories to "manual" with needsReview=true.
 * Sets needsReview=true when any confidence score < 0.5.
 */
function mapToExpense(raw, userId, source, sourceRef) {
    let needsReview = false;
    // Check confidence scores — flag for review if any < 0.5
    if (raw.amount.confidence < 0.5 ||
        raw.category.confidence < 0.5 ||
        raw.dueDate.confidence < 0.5) {
        needsReview = true;
    }
    // Map category — default to "manual" if unrecognized
    let category = raw.category.value;
    if (!ALLOWED_CATEGORIES.includes(category)) {
        category = "manual";
        needsReview = true;
    }
    return {
        id: (0, uuid_1.v4)(),
        userId,
        category,
        amount: raw.amount.value,
        currency: "THB",
        dueDate: raw.dueDate.value,
        isPaid: false,
        extractedVia: source,
        rawSourceRef: sourceRef,
        needsReview,
        createdAt: new Date().toISOString(),
    };
}
/**
 * Validates partial expense data.
 * Checks: amount > 0, category in allowed set, dueDate is a valid date.
 */
function validateExpenseData(data) {
    const errors = [];
    let needsReview = false;
    if (data.amount !== undefined && data.amount <= 0) {
        errors.push("amount must be positive");
    }
    if (data.category !== undefined && !ALLOWED_CATEGORIES.includes(data.category)) {
        errors.push("invalid category");
        needsReview = true;
    }
    if (data.dueDate !== undefined) {
        const parsed = new Date(data.dueDate);
        if (isNaN(parsed.getTime())) {
            errors.push("invalid due date");
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        needsReview,
    };
}
/**
 * Serializes an Expense object to a JSON string.
 */
function serializeExpense(expense) {
    return JSON.stringify(expense);
}
/**
 * Deserializes a JSON string back into an Expense object.
 */
function deserializeExpense(json) {
    return JSON.parse(json);
}
//# sourceMappingURL=dataMapper.js.map