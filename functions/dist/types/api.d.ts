export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
}
export type ExpenseCategory = "electricity" | "water" | "insurance" | "loan" | "gas" | "manual";
export type ExtractionSource = "email" | "image" | "manual";
//# sourceMappingURL=api.d.ts.map