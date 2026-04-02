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
export declare function createAccountService(deps: AccountServiceDeps): {
    deleteAccount: (userId: string) => Promise<DeleteAccountResult>;
};
//# sourceMappingURL=accountService.d.ts.map