"use strict";
/**
 * Account deletion service.
 *
 * Removes all user data across expenses, budgets, notifications collections,
 * cleans up Firebase Storage files, and deletes the user record itself.
 *
 * Requirement 8.5: Account deletion removes all user data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccountService = createAccountService;
function createAccountService(deps) {
    const { userStore, expenseStore, budgetStore, notificationStore, storageBucket, } = deps;
    /**
     * Delete all data associated with a user:
     * 1. All expenses
     * 2. All budgets
     * 3. All notifications
     * 4. Firebase Storage files (bill images)
     * 5. The user record itself
     */
    async function deleteAccount(userId) {
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
            }
            catch {
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
//# sourceMappingURL=accountService.js.map