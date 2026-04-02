import { createAccountService } from "../../src/services/accountService";
import { createInMemoryStore } from "../../src/services/firestore";
import { UserRecord } from "../../src/services/authService";
import { Expense } from "../../src/types/expense";
import { Budget } from "../../src/types/budget";
import { Notification } from "../../src/types/notification";
import { StorageBucket, StorageFile } from "../../src/services/storageCleanup";

describe("AccountService.deleteAccount", () => {
  function createStores() {
    return {
      userStore: createInMemoryStore<UserRecord>(),
      expenseStore: createInMemoryStore<Expense>(),
      budgetStore: createInMemoryStore<Budget>(),
      notificationStore: createInMemoryStore<Notification>(),
    };
  }

  const userId = "user-1";
  const otherUserId = "user-2";

  async function seedData(stores: ReturnType<typeof createStores>) {
    // User record
    await stores.userStore.set(userId, {
      id: userId,
      email: "test@example.com",
      passwordHash: "hash",
      monthlyIncome: 50000,
      createdAt: new Date().toISOString(),
    });

    // Expenses for user-1
    await stores.expenseStore.set("exp-1", {
      id: "exp-1",
      userId,
      category: "electricity",
      amount: 1500,
      currency: "THB",
      dueDate: "2025-03-15",
      isPaid: false,
      extractedVia: "manual",
      createdAt: new Date().toISOString(),
    });
    await stores.expenseStore.set("exp-2", {
      id: "exp-2",
      userId,
      category: "water",
      amount: 300,
      currency: "THB",
      dueDate: "2025-03-10",
      isPaid: true,
      extractedVia: "email",
      createdAt: new Date().toISOString(),
    });

    // Budget for user-1
    await stores.budgetStore.set("budget-1", {
      id: "budget-1",
      userId,
      month: "2025-03",
      totalBudget: 20000,
      categoryBudgets: [{ category: "electricity", amount: 2000 }],
      savingsGoal: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Notification for user-1
    await stores.notificationStore.set("notif-1", {
      id: "notif-1",
      userId,
      type: "bill_due",
      title: "Bill Due",
      body: "Your electricity bill is due",
      data: {},
      channel: "push",
      sentAt: new Date().toISOString(),
      readAt: null,
    });

    // Data for another user (should NOT be deleted)
    await stores.userStore.set(otherUserId, {
      id: otherUserId,
      email: "other@example.com",
      passwordHash: "hash2",
      monthlyIncome: 30000,
      createdAt: new Date().toISOString(),
    });
    await stores.expenseStore.set("exp-other", {
      id: "exp-other",
      userId: otherUserId,
      category: "gas",
      amount: 500,
      currency: "THB",
      dueDate: "2025-03-20",
      isPaid: false,
      extractedVia: "manual",
      createdAt: new Date().toISOString(),
    });
  }

  it("removes all expenses for the user", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    await service.deleteAccount(userId);

    const remaining = await stores.expenseStore.findAllBy("userId", userId);
    expect(remaining).toHaveLength(0);
  });

  it("removes all budgets for the user", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    await service.deleteAccount(userId);

    const remaining = await stores.budgetStore.findAllBy("userId", userId);
    expect(remaining).toHaveLength(0);
  });

  it("removes all notifications for the user", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    await service.deleteAccount(userId);

    const remaining = await stores.notificationStore.findAllBy("userId", userId);
    expect(remaining).toHaveLength(0);
  });

  it("deletes the user record", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    const result = await service.deleteAccount(userId);

    expect(result.userDeleted).toBe(true);
    const user = await stores.userStore.get(userId);
    expect(user).toBeUndefined();
  });

  it("does not affect other users' data", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    await service.deleteAccount(userId);

    const otherUser = await stores.userStore.get(otherUserId);
    expect(otherUser).toBeDefined();
    const otherExpenses = await stores.expenseStore.findAllBy("userId", otherUserId);
    expect(otherExpenses).toHaveLength(1);
  });

  it("returns correct deletion counts", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    const result = await service.deleteAccount(userId);

    expect(result.deletedExpenses).toBe(2);
    expect(result.deletedBudgets).toBe(1);
    expect(result.deletedNotifications).toBe(1);
    expect(result.userDeleted).toBe(true);
  });

  it("cleans up Firebase Storage files when bucket is provided", async () => {
    const stores = createStores();
    await seedData(stores);

    const deletedFiles: string[] = [];
    const mockFile: StorageFile = {
      name: `bill-images/${userId}/receipt.jpg`,
      getMetadata: async () => [{ timeCreated: new Date().toISOString() }],
      delete: async () => { deletedFiles.push(mockFile.name); },
    };
    const mockBucket: StorageBucket = {
      getFiles: async () => [[mockFile]],
    };

    const service = createAccountService({ ...stores, storageBucket: mockBucket });
    const result = await service.deleteAccount(userId);

    expect(result.deletedFiles).toBe(1);
    expect(deletedFiles).toContain(`bill-images/${userId}/receipt.jpg`);
  });

  it("handles missing storage bucket gracefully", async () => {
    const stores = createStores();
    await seedData(stores);
    const service = createAccountService(stores);

    const result = await service.deleteAccount(userId);

    expect(result.deletedFiles).toBe(0);
    // Should not throw
  });

  it("handles storage errors gracefully", async () => {
    const stores = createStores();
    await seedData(stores);

    const mockBucket: StorageBucket = {
      getFiles: async () => { throw new Error("Storage unavailable"); },
    };

    const service = createAccountService({ ...stores, storageBucket: mockBucket });
    const result = await service.deleteAccount(userId);

    // Storage failure should not prevent user data deletion
    expect(result.deletedFiles).toBe(0);
    expect(result.userDeleted).toBe(true);
    expect(result.deletedExpenses).toBe(2);
  });

  it("handles deleting a user with no data", async () => {
    const stores = createStores();
    await stores.userStore.set("empty-user", {
      id: "empty-user",
      email: "empty@example.com",
      passwordHash: "hash",
      monthlyIncome: null,
      createdAt: new Date().toISOString(),
    });

    const service = createAccountService(stores);
    const result = await service.deleteAccount("empty-user");

    expect(result.deletedExpenses).toBe(0);
    expect(result.deletedBudgets).toBe(0);
    expect(result.deletedNotifications).toBe(0);
    expect(result.userDeleted).toBe(true);
  });
});
