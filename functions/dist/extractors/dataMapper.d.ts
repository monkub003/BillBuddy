import { Expense } from "../types/expense";
import { ExtractionResult, ValidationResult } from "../types/extraction";
/**
 * Maps raw AI extraction output to a valid Expense record.
 * Defaults unrecognized categories to "manual" with needsReview=true.
 * Sets needsReview=true when any confidence score < 0.5.
 */
export declare function mapToExpense(raw: ExtractionResult, userId: string, source: "email" | "image", sourceRef: string): Expense;
/**
 * Validates partial expense data.
 * Checks: amount > 0, category in allowed set, dueDate is a valid date.
 */
export declare function validateExpenseData(data: Partial<Expense>): ValidationResult;
/**
 * Serializes an Expense object to a JSON string.
 */
export declare function serializeExpense(expense: Expense): string;
/**
 * Deserializes a JSON string back into an Expense object.
 */
export declare function deserializeExpense(json: string): Expense;
//# sourceMappingURL=dataMapper.d.ts.map