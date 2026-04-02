import {
  createNotificationService,
  getLeadDays,
  shouldSendReminder,
  isPredictedSpike,
  isBudgetAlertNeeded,
  FCMClient,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../../src/services/notificationService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Notification, NotificationPreferences } from "../../src/types/notification";
import type { RecurringExpense, PredictionResult } from "../../src/types/prediction";
import type { BudgetStatus } from "../../src/types/notification";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBill(overrides?: Partial<RecurringExpense>): RecurringExpense {
  return {
    category: "electricity",
    amount: 2500,
    frequency: "monthly",
    nextDueDate: "2025-04-15T00:00:00.000Z",
    confidence: 0.9,
    ...overrides,
  };
}

function makePrediction(overrides?: Partial<PredictionResult>): PredictionResult {
  return {
    category: "electricity",
    predictedMin: 2000,
    predictedMax: 3000,
    confidence: 0.85,
    factors: { weatherImpact: "hot", economicFactor: 2000 },
    ...overrides,
  };
}

function makeBudgetStatus(overrides?: Partial<BudgetStatus>): BudgetStatus {
  return {
    month: "2025-03",
    budgetTotal: 25000,
    spentTotal: 20000,
    usagePercentage: 0.8,
    overBudgetCategories: [],
    ...overrides,
  };
}

function createMockFCM(): FCMClient & { calls: Array<{ userId: string; title: string; body: string }> } {
  const calls: Array<{ userId: string; title: string; body: string }> = [];
  return {
    calls,
    async send(userId: string, title: string, body: string) {
      calls.push({ userId, title, body });
    },
  };
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("getLeadDays", () => {
  it("returns 7 for monthly bills", () => {
    expect(getLeadDays("monthly")).toBe(7);
  });

  it("returns 7 for quarterly bills", () => {
    expect(getLeadDays("quarterly")).toBe(7);
  });

  it("returns 30 for yearly bills", () => {
    expect(getLeadDays("yearly")).toBe(30);
  });
});

describe("shouldSendReminder", () => {
  it("returns true when due date is within lead window", () => {
    const ref = new Date("2025-04-10T00:00:00.000Z");
    const bill = makeBill({ nextDueDate: "2025-04-15T00:00:00.000Z", frequency: "monthly" });
    expect(shouldSendReminder(bill, ref)).toBe(true);
  });

  it("returns false when due date is past", () => {
    const ref = new Date("2025-04-20T00:00:00.000Z");
    const bill = makeBill({ nextDueDate: "2025-04-15T00:00:00.000Z" });
    expect(shouldSendReminder(bill, ref)).toBe(false);
  });

  it("returns false when due date is too far away for monthly", () => {
    const ref = new Date("2025-04-01T00:00:00.000Z");
    const bill = makeBill({ nextDueDate: "2025-04-15T00:00:00.000Z", frequency: "monthly" });
    // 14 days away > 7 day lead
    expect(shouldSendReminder(bill, ref)).toBe(false);
  });

  it("returns true for yearly bill within 30-day window", () => {
    const ref = new Date("2025-03-20T00:00:00.000Z");
    const bill = makeBill({
      nextDueDate: "2025-04-15T00:00:00.000Z",
      frequency: "yearly",
    });
    // 26 days away ≤ 30
    expect(shouldSendReminder(bill, ref)).toBe(true);
  });

  it("returns false for yearly bill outside 30-day window", () => {
    const ref = new Date("2025-03-01T00:00:00.000Z");
    const bill = makeBill({
      nextDueDate: "2025-04-15T00:00:00.000Z",
      frequency: "yearly",
    });
    // 45 days away > 30
    expect(shouldSendReminder(bill, ref)).toBe(false);
  });
});

describe("isPredictedSpike", () => {
  it("returns true when midpoint exceeds baseline by >15%", () => {
    // midpoint = 2500, baseline (economicFactor) = 2000 → 25% increase
    const pred = makePrediction();
    expect(isPredictedSpike(pred)).toBe(true);
  });

  it("returns false when increase is ≤15%", () => {
    // midpoint = 2150, baseline = 2000 → 7.5%
    const pred = makePrediction({ predictedMin: 2000, predictedMax: 2300 });
    expect(isPredictedSpike(pred)).toBe(false);
  });

  it("returns false when baseline is zero", () => {
    const pred = makePrediction({
      predictedMin: 0,
      predictedMax: 100,
      factors: { weatherImpact: "none", economicFactor: 0 },
    });
    expect(isPredictedSpike(pred)).toBe(false);
  });
});

describe("isBudgetAlertNeeded", () => {
  it("returns true when usage ≥ 80%", () => {
    expect(isBudgetAlertNeeded(makeBudgetStatus({ usagePercentage: 0.8 }))).toBe(true);
    expect(isBudgetAlertNeeded(makeBudgetStatus({ usagePercentage: 0.95 }))).toBe(true);
  });

  it("returns false when usage < 80%", () => {
    expect(isBudgetAlertNeeded(makeBudgetStatus({ usagePercentage: 0.79 }))).toBe(false);
    expect(isBudgetAlertNeeded(makeBudgetStatus({ usagePercentage: 0.5 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Service integration tests
// ---------------------------------------------------------------------------

describe("NotificationService.sendBillDueReminder", () => {
  it("stores a bill_due notification with correct fields", async () => {
    const store = createInMemoryStore<Notification>();
    const fcm = createMockFCM();
    const svc = createNotificationService({ notificationStore: store, fcmClient: fcm });

    const bill = makeBill();
    await svc.sendBillDueReminder("user-1", bill);

    const all = await store.getAll();
    expect(all).toHaveLength(1);

    const notif = all[0];
    expect(notif.userId).toBe("user-1");
    expect(notif.type).toBe("bill_due");
    expect(notif.data.category).toBe("electricity");
    expect(notif.data.amount).toBe(2500);
    expect(notif.data.dueDate).toBe(bill.nextDueDate);
    expect(notif.data.leadDays).toBe(7);
    expect(notif.readAt).toBeNull();
    expect(notif.channel).toBe("push");
  });

  it("sets leadDays to 30 for yearly bills", async () => {
    const store = createInMemoryStore<Notification>();
    const svc = createNotificationService({ notificationStore: store });

    await svc.sendBillDueReminder("user-1", makeBill({ frequency: "yearly" }));

    const all = await store.getAll();
    expect(all[0].data.leadDays).toBe(30);
  });

  it("calls FCM with correct userId and title", async () => {
    const fcm = createMockFCM();
    const svc = createNotificationService({ fcmClient: fcm });

    await svc.sendBillDueReminder("user-1", makeBill());

    expect(fcm.calls).toHaveLength(1);
    expect(fcm.calls[0].userId).toBe("user-1");
    expect(fcm.calls[0].title).toContain("Bill Due Reminder");
  });
});

describe("NotificationService.sendExpenseWarning", () => {
  it("stores a trend_warning notification with spike details", async () => {
    const store = createInMemoryStore<Notification>();
    const fcm = createMockFCM();
    const svc = createNotificationService({ notificationStore: store, fcmClient: fcm });

    const pred = makePrediction();
    await svc.sendExpenseWarning("user-2", pred);

    const all = await store.getAll();
    expect(all).toHaveLength(1);

    const notif = all[0];
    expect(notif.userId).toBe("user-2");
    expect(notif.type).toBe("trend_warning");
    expect(notif.data.category).toBe("electricity");
    expect(notif.data.predictedMin).toBe(2000);
    expect(notif.data.predictedMax).toBe(3000);
    expect(typeof notif.data.increasePercent).toBe("number");
    expect(notif.readAt).toBeNull();
  });

  it("calls FCM with warning title", async () => {
    const fcm = createMockFCM();
    const svc = createNotificationService({ fcmClient: fcm });

    await svc.sendExpenseWarning("user-2", makePrediction());

    expect(fcm.calls).toHaveLength(1);
    expect(fcm.calls[0].title).toContain("Expense Warning");
  });
});

describe("NotificationService.sendBudgetAlert", () => {
  it("stores a budget_alert notification when spending ≥ 80%", async () => {
    const store = createInMemoryStore<Notification>();
    const fcm = createMockFCM();
    const svc = createNotificationService({ notificationStore: store, fcmClient: fcm });

    const status = makeBudgetStatus({ usagePercentage: 0.85 });
    await svc.sendBudgetAlert("user-3", status);

    const all = await store.getAll();
    expect(all).toHaveLength(1);

    const notif = all[0];
    expect(notif.userId).toBe("user-3");
    expect(notif.type).toBe("budget_alert");
    expect(notif.data.budgetTotal).toBe(25000);
    expect(notif.data.spentTotal).toBe(20000);
    expect(notif.data.usagePercentage).toBe(0.85);
    expect(notif.readAt).toBeNull();
  });

  it("includes overBudgetCategories in notification data", async () => {
    const store = createInMemoryStore<Notification>();
    const svc = createNotificationService({ notificationStore: store });

    const status = makeBudgetStatus({
      overBudgetCategories: ["electricity", "water"],
    });
    await svc.sendBudgetAlert("user-3", status);

    const all = await store.getAll();
    expect(all[0].data.overBudgetCategories).toContain("electricity");
  });

  it("calls FCM with budget alert title", async () => {
    const fcm = createMockFCM();
    const svc = createNotificationService({ fcmClient: fcm });

    await svc.sendBudgetAlert("user-3", makeBudgetStatus());

    expect(fcm.calls).toHaveLength(1);
    expect(fcm.calls[0].title).toBe("Budget Alert");
  });
});

describe("NotificationService default deps", () => {
  it("works without providing any deps (uses defaults)", async () => {
    const svc = createNotificationService();
    // Should not throw
    await svc.sendBillDueReminder("u1", makeBill());
    await svc.sendExpenseWarning("u1", makePrediction());
    await svc.sendBudgetAlert("u1", makeBudgetStatus());

    const all = await svc.notificationStore.getAll();
    expect(all).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Notification preferences tests (Task 9.2 – Req 5.5)
// ---------------------------------------------------------------------------

describe("NotificationService.getNotificationPreferences", () => {
  it("returns sensible defaults when no preferences exist", async () => {
    const svc = createNotificationService();
    const prefs = await svc.getNotificationPreferences("user-new");

    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(prefs.channels).toContain("push");
    expect(prefs.billReminder.enabled).toBe(true);
    expect(prefs.billReminder.daysBefore).toBe(7);
    expect(prefs.budgetAlert.enabled).toBe(true);
    expect(prefs.budgetAlert.threshold).toBe(0.8);
    expect(prefs.trendWarning.enabled).toBe(true);
    expect(prefs.yearlyExpenseReminder.enabled).toBe(true);
    expect(prefs.yearlyExpenseReminder.daysBefore).toBe(30);
  });

  it("returns stored preferences when they exist", async () => {
    const svc = createNotificationService();

    const custom: NotificationPreferences = {
      channels: ["push", "email"],
      billReminder: { enabled: false, daysBefore: 3 },
      budgetAlert: { enabled: true, threshold: 0.9 },
      trendWarning: { enabled: false },
      yearlyExpenseReminder: { enabled: true, daysBefore: 14 },
    };
    await svc.updateNotificationPreferences("user-1", custom);

    const prefs = await svc.getNotificationPreferences("user-1");
    expect(prefs).toEqual(custom);
  });

  it("does not leak id or userId fields in the returned preferences", async () => {
    const svc = createNotificationService();

    await svc.updateNotificationPreferences("user-1", DEFAULT_NOTIFICATION_PREFERENCES);
    const prefs = await svc.getNotificationPreferences("user-1");

    expect(prefs).not.toHaveProperty("id");
    expect(prefs).not.toHaveProperty("userId");
  });

  it("returns independent defaults (mutating result does not affect future calls)", async () => {
    const svc = createNotificationService();

    const prefs1 = await svc.getNotificationPreferences("user-x");
    prefs1.channels.push("email");

    const prefs2 = await svc.getNotificationPreferences("user-x");
    expect(prefs2.channels).toEqual(["push"]);
  });
});

describe("NotificationService.updateNotificationPreferences", () => {
  it("creates preferences for a new user", async () => {
    const svc = createNotificationService();

    const custom: NotificationPreferences = {
      channels: ["email"],
      billReminder: { enabled: true, daysBefore: 5 },
      budgetAlert: { enabled: false, threshold: 0.5 },
      trendWarning: { enabled: true },
      yearlyExpenseReminder: { enabled: false, daysBefore: 7 },
    };
    await svc.updateNotificationPreferences("user-new", custom);

    const prefs = await svc.getNotificationPreferences("user-new");
    expect(prefs).toEqual(custom);
  });

  it("updates existing preferences (upsert)", async () => {
    const svc = createNotificationService();

    const initial: NotificationPreferences = {
      channels: ["push"],
      billReminder: { enabled: true, daysBefore: 7 },
      budgetAlert: { enabled: true, threshold: 0.8 },
      trendWarning: { enabled: true },
      yearlyExpenseReminder: { enabled: true, daysBefore: 30 },
    };
    await svc.updateNotificationPreferences("user-1", initial);

    const updated: NotificationPreferences = {
      channels: ["push", "email"],
      billReminder: { enabled: true, daysBefore: 3 },
      budgetAlert: { enabled: false, threshold: 0.6 },
      trendWarning: { enabled: false },
      yearlyExpenseReminder: { enabled: true, daysBefore: 14 },
    };
    await svc.updateNotificationPreferences("user-1", updated);

    const prefs = await svc.getNotificationPreferences("user-1");
    expect(prefs).toEqual(updated);
  });

  it("keeps preferences isolated between users", async () => {
    const svc = createNotificationService();

    const prefsA: NotificationPreferences = {
      channels: ["push"],
      billReminder: { enabled: true, daysBefore: 7 },
      budgetAlert: { enabled: true, threshold: 0.8 },
      trendWarning: { enabled: true },
      yearlyExpenseReminder: { enabled: true, daysBefore: 30 },
    };
    const prefsB: NotificationPreferences = {
      channels: ["email"],
      billReminder: { enabled: false, daysBefore: 1 },
      budgetAlert: { enabled: false, threshold: 0.5 },
      trendWarning: { enabled: false },
      yearlyExpenseReminder: { enabled: false, daysBefore: 7 },
    };

    await svc.updateNotificationPreferences("user-a", prefsA);
    await svc.updateNotificationPreferences("user-b", prefsB);

    expect(await svc.getNotificationPreferences("user-a")).toEqual(prefsA);
    expect(await svc.getNotificationPreferences("user-b")).toEqual(prefsB);
  });
});
