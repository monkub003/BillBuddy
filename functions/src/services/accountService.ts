/**
 * Account deletion service.
 *
 * Removes all user data across expenses, budgets, notifications collections,
 * cleans up Firebase Storage files, and deletes the user record itself.
 *
 * Requirement 8.5: Account deletion removes all user data.
 */

import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { Notification } from "../types/notification";
import { FirestoreStore } from "./firestore";
import { UserRecord } from "./authService";
import { StorageBucket } from "./storageCleanup";

export interface AccountServiceDeps {
  userStore: FirestoreStore<UserRecord>;
  expenseStore: FirestoreStore<Expense>;
  budgetStore: FirestoreStore<Budget>;
  notificationStore: FirestoreStore<Notification>;
  storageBucket?: StorageBucket;
}

export interface DeleteAccountResult {
  deletedExpenses: number;
  deletedBudgets: number;
  deletedNotifications: number;
  deletedFiles: number;
  userDeleted: boolean;
}

export function createAccountService(deps: AccountServiceDeps) {
  const {
    userStore,
    expenseStore,
    budgetStore,
    notificationStore,
    storageBucket,
  } = deps;

  /**
   * Delete all data associated with a user:
   * 1. All expenses
   * 2. All budgets
   * 3. All notifications
   * 4. Firebase Storage files (bill images)
   * 5. The user record itself
   */
  async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
    // 1. Delete all expenses for the user
    const expenses = await expenseStore.findAllBy("userId", userId);
    for (const expense of expenses) {
      await expenseStore.delete(expense.id);
    }

    // 2. Delete all budgets for the user
    const budgets = await budgetStore.findAllBy("userId", userId);
    for (const budget of budgets) {
      await budgetStore.delete(budget.id);
    }

    // 3. Delete all notifications for the user
    const notifications = await notificationStore.findAllBy("userId", userId);
    for (const notification of notifications) {
      await notificationStore.delete(notification.id);
    }

    // 4. Clean up Firebase Storage files (bill images)
    let deletedFiles = 0;
    if (storageBucket) {
      try {
        const prefix = `bill-images/${userId}/`;
        const [files] = await storageBucket.getFiles({ prefix });
        for (const file of files) {
          await file.delete();
          deletedFiles++;
        }
      } catch {
        // Storage cleanup is best-effort; don't fail the whole deletion
      }
    }

    // 5. Delete the user record
    const userDeleted = await userStore.delete(userId);

    return {
      deletedExpenses: expenses.length,
      deletedBudgets: budgets.length,
      deletedNotifications: notifications.length,
      deletedFiles,
      userDeleted,
    };
  }

  return { deleteAccount };
}
