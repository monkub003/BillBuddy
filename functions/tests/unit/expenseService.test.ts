import { createExpenseService } from "../../src/services/expenseService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense, CreateExpenseInput } from "../../src/types/expense";

function makeInput(overrides?: Partial<CreateExpenseInput>): CreateExpenseInput {
  return {
    category: "electricity",
    amount: 150.5,
    dueDate: "2025-02-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    ...overrides,
  };
}

function freshService() {
  return createExpenseService({
    expenseStore: createInMemoryStore<Expense>(),
  });
}

// ---------------------------------------------------------------------------
// createExpense
// ---------------------------------------------------------------------------
describe("ExpenseService.createExpense", () => {
  it("creates an expense with valid input and returns it", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput());

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.userId).toBe("user-1");
    expect(result.data!.category).toBe("electricity");
    expect(result.data!.amount).toBe(150.5);
    expect(result.data!.currency).toBe("THB");
    expect(result.data!.extractedVia).toBe("manual");
    expect(result.data!.id).toBeDefined();
    expect(result.data!.createdAt).toBeDefined();
  });

  it("enforces currency = THB regardless of input", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput());
    expect(result.data!.currency).toBe("THB");
  });

  it("sets extractedVia from input data", async () => {
    const svc = freshService();
    const r1 = await svc.createExpense("u1", makeInput({ extractedVia: "image", rawSourceRef: "gs://bucket/img.jpg" }));
    expect(r1.data!.extractedVia).toBe("image");

    const r2 = await svc.createExpense("u1", makeInput({ extractedVia: "email", rawSourceRef: "email-123" }));
    expect(r2.data!.extractedVia).toBe("email");

    const r3 = await svc.createExpense("u1", makeInput({ extractedVia: "manual" }));
    expect(r3.data!.extractedVia).toBe("manual");
  });

  it("rejects amount = 0", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput({ amount: 0 }));
    expect(result.data).toBeNull();
    expect(result.error).toBe("amount must be positive");
  });

  it("rejects negative amount", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput({ amount: -10 }));
    expect(result.data).toBeNull();
    expect(result.error).toBe("amount must be positive");
  });

  it("accepts smallest positive amount (boundary)", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput({ amount: 0.01 }));
    expect(result.error).toBeNull();
    expect(result.data!.amount).toBe(0.01);
  });

  it("rejects invalid category", async () => {
    const svc = freshService();
    const result = await svc.createExpense("user-1", makeInput({ category: "food" as any }));
    expect(result.data).toBeNull();
    expect(result.error).toBe("invalid category");
  });

  it("accepts every valid category", async () => {
    const svc = freshService();
    const categories = ["electricity", "water", "insurance", "loan", "gas", "manual"] as const;
    for (const cat of categories) {
      const result = await svc.createExpense("user-1", makeInput({ category: cat }));
      expect(result.error).toBeNull();
      expect(result.data!.category).toBe(cat);
    }
  });
});


// ---------------------------------------------------------------------------
// getExpenses
// ---------------------------------------------------------------------------
describe("ExpenseService.getExpenses", () => {
  it("returns only expenses belonging to the given userId", async () => {
    const svc = freshService();
    await svc.createExpense("user-A", makeInput({ amount: 100 }));
    await svc.createExpense("user-B", makeInput({ amount: 200 }));
    await svc.createExpense("user-A", makeInput({ amount: 300 }));

    const result = await svc.getExpenses("user-A");
    expect(result.error).toBeNull();
    expect(result.data!.length).toBe(2);
    expect(result.data!.every((e) => e.userId === "user-A")).toBe(true);
  });

  it("returns empty array when user has no expenses", async () => {
    const svc = freshService();
    const result = await svc.getExpenses("user-X");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("filters by category", async () => {
    const svc = freshService();
    await svc.createExpense("u1", makeInput({ category: "electricity" }));
    await svc.createExpense("u1", makeInput({ category: "water" }));
    await svc.createExpense("u1", makeInput({ category: "electricity" }));

    const result = await svc.getExpenses("u1", { category: "water" });
    expect(result.data!.length).toBe(1);
    expect(result.data![0].category).toBe("water");
  });

  it("filters by isPaid", async () => {
    const svc = freshService();
    await svc.createExpense("u1", makeInput({ isPaid: true }));
    await svc.createExpense("u1", makeInput({ isPaid: false }));
    await svc.createExpense("u1", makeInput({ isPaid: true }));

    const result = await svc.getExpenses("u1", { isPaid: false });
    expect(result.data!.length).toBe(1);
    expect(result.data![0].isPaid).toBe(false);
  });

  it("filters by month and year", async () => {
    const svc = freshService();
    await svc.createExpense("u1", makeInput({ dueDate: "2025-01-15T00:00:00.000Z" }));
    await svc.createExpense("u1", makeInput({ dueDate: "2025-02-15T00:00:00.000Z" }));
    await svc.createExpense("u1", makeInput({ dueDate: "2025-02-20T00:00:00.000Z" }));

    const result = await svc.getExpenses("u1", { month: 2, year: 2025 });
    expect(result.data!.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------
describe("ExpenseService.updateExpense", () => {
  it("updates fields on an owned expense", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput({ amount: 100, isPaid: false }));
    const id = created.data!.id;

    const result = await svc.updateExpense("u1", id, { amount: 200, isPaid: true });
    expect(result.error).toBeNull();
    expect(result.data!.amount).toBe(200);
    expect(result.data!.isPaid).toBe(true);
    // Immutable fields preserved
    expect(result.data!.userId).toBe("u1");
    expect(result.data!.currency).toBe("THB");
  });

  it("returns access denied when expense belongs to another user", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.updateExpense("u2", id, { amount: 999 });
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");
  });

  it("returns access denied when expense does not exist", async () => {
    const svc = freshService();
    const result = await svc.updateExpense("u1", "nonexistent-id", { amount: 100 });
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");
  });

  it("rejects update with non-positive amount", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.updateExpense("u1", id, { amount: 0 });
    expect(result.data).toBeNull();
    expect(result.error).toBe("amount must be positive");
  });

  it("rejects update with invalid category", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.updateExpense("u1", id, { category: "food" as any });
    expect(result.data).toBeNull();
    expect(result.error).toBe("invalid category");
  });

  it("preserves currency as THB even if update tries to change it", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.updateExpense("u1", id, { currency: "USD" as any });
    expect(result.data!.currency).toBe("THB");
  });
});

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------
describe("ExpenseService.deleteExpense", () => {
  it("deletes an owned expense", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.deleteExpense("u1", id);
    expect(result.error).toBeNull();

    // Verify it's gone
    const list = await svc.getExpenses("u1");
    expect(list.data!.length).toBe(0);
  });

  it("returns access denied when expense belongs to another user", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.deleteExpense("u2", id);
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");

    // Verify it still exists
    const list = await svc.getExpenses("u1");
    expect(list.data!.length).toBe(1);
  });

  it("returns access denied when expense does not exist", async () => {
    const svc = freshService();
    const result = await svc.deleteExpense("u1", "nonexistent-id");
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");
  });
});


// ---------------------------------------------------------------------------
// confirmExpense
// ---------------------------------------------------------------------------
describe("ExpenseService.confirmExpense", () => {
  it("sets needsReview to false on an owned expense", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    // Manually set needsReview to true (simulating extraction flow)
    await svc.updateExpense("u1", id, { needsReview: true } as any);

    const result = await svc.confirmExpense("u1", id);
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.needsReview).toBe(false);
    expect(result.data!.id).toBe(id);
    expect(result.data!.userId).toBe("u1");
  });

  it("returns access denied when expense belongs to another user", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput());
    const id = created.data!.id;

    const result = await svc.confirmExpense("u2", id);
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");
  });

  it("returns access denied when expense does not exist", async () => {
    const svc = freshService();
    const result = await svc.confirmExpense("u1", "nonexistent-id");
    expect(result.data).toBeNull();
    expect(result.error).toBe("access denied");
  });

  it("preserves all other fields when confirming", async () => {
    const svc = freshService();
    const created = await svc.createExpense("u1", makeInput({ amount: 250, category: "water" }));
    const id = created.data!.id;

    await svc.updateExpense("u1", id, { needsReview: true } as any);

    const result = await svc.confirmExpense("u1", id);
    expect(result.data!.amount).toBe(250);
    expect(result.data!.category).toBe("water");
    expect(result.data!.currency).toBe("THB");
    expect(result.data!.needsReview).toBe(false);
  });
});
