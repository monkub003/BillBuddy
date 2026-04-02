"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseService = createExpenseService;
const uuid_1 = require("uuid");
const firestore_1 = require("./firestore");
const ALLOWED_CATEGORIES = [
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
];
function createExpenseService(deps) {
    const expenseStore = deps?.expenseStore ?? (0, firestore_1.createInMemoryStore)();
    async function createExpense(userId, data) {
        if (data.amount <= 0) {
            return { data: null, error: "amount must be positive" };
        }
        if (!ALLOWED_CATEGORIES.includes(data.category)) {
            return { data: null, error: "invalid category" };
        }
        const expense = {
            id: (0, uuid_1.v4)(),
            userId,
            category: data.category,
            amount: data.amount,
            currency: "THB",
            dueDate: data.dueDate,
            isPaid: data.isPaid,
            extractedVia: data.extractedVia,
            rawSourceRef: data.rawSourceRef,
            needsReview: data.needsReview ?? false,
            createdAt: new Date().toISOString(),
        };
        await expenseStore.set(expense.id, expense);
        return { data: expense, error: null };
    }
    async function getExpenses(userId, filters) {
        const all = await expenseStore.getAll();
        let results = all.filter((e) => e.userId === userId);
        if (filters?.category) {
            results = results.filter((e) => e.category === filters.category);
        }
        if (filters?.isPaid !== undefined) {
            results = results.filter((e) => e.isPaid === filters.isPaid);
        }
        if (filters?.month !== undefined && filters?.year !== undefined) {
            results = results.filter((e) => {
                const d = new Date(e.dueDate);
                return d.getMonth() + 1 === filters.month && d.getFullYear() === filters.year;
            });
        }
        return { data: results, error: null };
    }
    async function updateExpense(userId, expenseId, data) {
        const existing = await expenseStore.get(expenseId);
        if (!existing) {
            return { data: null, error: "access denied" };
        }
        if (existing.userId !== userId) {
            return { data: null, error: "access denied" };
        }
        if (data.amount !== undefined && data.amount <= 0) {
            return { data: null, error: "amount must be positive" };
        }
        if (data.category !== undefined && !ALLOWED_CATEGORIES.includes(data.category)) {
            return { data: null, error: "invalid category" };
        }
        const updated = {
            ...existing,
            ...data,
            // Immutable fields — always keep original values
            id: existing.id,
            userId: existing.userId,
            currency: "THB",
            createdAt: existing.createdAt,
        };
        await expenseStore.set(expenseId, updated);
        return { data: updated, error: null };
    }
    async function deleteExpense(userId, expenseId) {
        const existing = await expenseStore.get(expenseId);
        if (!existing) {
            return { data: null, error: "access denied" };
        }
        if (existing.userId !== userId) {
            return { data: null, error: "access denied" };
        }
        await expenseStore.delete(expenseId);
        return { data: undefined, error: null };
    }
    async function confirmExpense(userId, expenseId) {
        const existing = await expenseStore.get(expenseId);
        if (!existing) {
            return { data: null, error: "access denied" };
        }
        if (existing.userId !== userId) {
            return { data: null, error: "access denied" };
        }
        const updated = {
            ...existing,
            needsReview: false,
        };
        await expenseStore.set(expenseId, updated);
        return { data: updated, error: null };
    }
    return { createExpense, getExpenses, updateExpense, deleteExpense, confirmExpense, _expenseStore: expenseStore };
}
//# sourceMappingURL=expenseService.js.map