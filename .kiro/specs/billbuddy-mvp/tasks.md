# Implementation Plan: BillBuddy MVP

## Overview

Implement BillBuddy, an AI-powered domestic expense tracking app using React Native/Expo (frontend) and Firebase Cloud Functions with Firestore (backend). The plan builds incrementally: core types and data layer first, then extraction/categorization, trend analysis, financial planning, notifications, dashboard UI, and finally integration wiring.

## Tasks

- [x] 1. Core types, data models, and Firestore abstraction
  - [x] 1.1 Align shared TypeScript types across `functions/src/types/` and `billbuddy/types/`
    - Ensure `Expense`, `User`, `Budget`, `Notification`, `ApiResponse`, `ExpenseCategory`, `ExtractionSource` interfaces match the design document
    - Add missing `Budget`, `Notification`, `NotificationPreferences`, `BudgetStatus` types
    - Add `BillParser` interface (`format`, `parse`, `serialize`, `deserialize`) to `functions/src/types/`
    - _Requirements: 8.1, 9.1_

  - [x] 1.2 Extend `FirestoreStore` with query helpers
    - Add `findAllBy(field, value)` method to return all matching records (needed for userId-scoped queries)
    - Update `createInMemoryStore` implementation in `functions/src/services/firestore.ts`
    - _Requirements: 8.1, 8.4_

  - [ ]* 1.3 Write property test for Expense Record Round-Trip (Serialization)
    - **Property 1: Expense Record Round-Trip (Serialization)**
    - Use fast-check to generate arbitrary valid Expense objects, verify `deserialize(serialize(expense))` equals original
    - **Validates: Requirements 9.1, 9.3**

  - [ ]* 1.4 Write property test for Expense Record Format Round-Trip (Display)
    - **Property 2: Expense Record Format Round-Trip (Display)**
    - Implement `format()` and `parse()` in `functions/src/extractors/dataMapper.ts`, verify `parse(format(expense))` equals original
    - **Validates: Requirements 9.2, 9.3**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Data extraction pipeline (Email + OCR)
  - [x] 3.1 Implement AI client interface and extraction logic
    - Verify `functions/src/extractors/aiClient.ts` exposes `AIClient` interface with `extractFromImage` and `extractFromText`
    - Ensure extraction results include confidence scores per field
    - Add image quality validation in `ocrExtractor.ts` (return clear error + tips for low-quality images per Req 1.4)
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 3.2 Implement extraction confirmation flow
    - Ensure all extraction results set `needsReview: true` on the Expense record before user confirmation
    - Add `confirmExpense(userId, expenseId)` to `expenseService` that sets `needsReview: false`
    - Wire confirmation endpoint in expense routes
    - _Requirements: 1.3_

  - [ ]* 3.3 Write property test for Email Extraction Completeness
    - **Property 3: Email Extraction Completeness**
    - For valid bill email payloads, verify ExtractionResult contains amount > 0, valid ISO date, valid ExpenseCategory
    - **Validates: Requirements 1.1**

  - [ ]* 3.4 Write property test for Image Extraction Line Items Consistency
    - **Property 4: Image Extraction Line Items Consistency**
    - For receipt extractions with line items, verify sum of line item amounts equals total
    - **Validates: Requirements 1.2**

  - [ ]* 3.5 Write property test for Extraction Requires User Confirmation
    - **Property 5: Extraction Requires User Confirmation**
    - For any successful extraction, verify the resulting Expense has `needsReview = true`
    - **Validates: Requirements 1.3**

- [x] 4. Expense categorization module
  - [x] 4.1 Implement `ExpenseCategorizer` service
    - Create `functions/src/services/categorizationService.ts`
    - Implement `categorize(expense)` returning `CategorizationResult` with confidence, alternatives
    - Set `needsUserConfirmation: true` when confidence < 0.7
    - Support default categories + user-created custom categories
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 4.2 Implement user correction learning
    - Add `recordUserCorrection(expenseId, correctCategory)` that stores correction history
    - Create a corrections store to track user overrides for future categorization improvement
    - _Requirements: 2.3_

  - [ ]* 4.3 Write property test for Auto-Categorization Assignment
    - **Property 6: Auto-Categorization Assignment**
    - For any valid CreateExpenseInput, verify assigned category is valid ExpenseCategory with confidence in [0.0, 1.0]
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 4.4 Write property test for Low Confidence Triggers User Confirmation
    - **Property 7: Low Confidence Triggers User Confirmation**
    - Verify confidence < 0.7 → `needsUserConfirmation: true`, confidence >= 0.7 → false
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 Write property test for User Correction Persistence
    - **Property 8: User Correction Persistence**
    - After recording correction, querying by expenseId returns matching correctCategory
    - **Validates: Requirements 2.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Trend analysis and prediction engine
  - [x] 6.1 Extend prediction engine with trend analysis
    - Add `analyzeTrend(userId, category, months)` returning `TrendResult` to `predictionEngine.ts`
    - Enforce minimum 3-month data requirement (return insufficient_data flag if < 3 months)
    - Implement >20% spike detection vs 3-month rolling average
    - _Requirements: 4.1, 4.4_

  - [x] 6.2 Implement weather-adjusted predictions
    - Enhance `computePrediction` to adjust electricity predictions based on temperature correlation
    - Ensure weather-adjusted prediction differs from base prediction when temperature deviates significantly
    - _Requirements: 4.2_

  - [x] 6.3 Implement recurring expense detection
    - Add `detectRecurringExpenses(userId)` to prediction engine
    - Detect monthly, quarterly, and yearly patterns from expense history
    - Return `RecurringExpense[]` with frequency, nextDueDate, confidence
    - _Requirements: 4.3_

  - [x] 6.4 Add confidence level to all predictions
    - Ensure every `PredictionResult` and `TrendResult` includes confidence in [0.0, 1.0]
    - _Requirements: 4.5_

  - [ ]* 6.5 Write property test for Trend Analysis Minimum Data Requirement
    - **Property 12: Trend Analysis Minimum Data Requirement**
    - For datasets with < 3 months, verify insufficient_data flag and no prediction produced
    - **Validates: Requirements 4.1**

  - [ ]* 6.6 Write property test for Weather-Adjusted Electricity Prediction
    - **Property 13: Weather-Adjusted Electricity Prediction**
    - For significant temperature deviation, verify electricity prediction differs from base
    - **Validates: Requirements 4.2**

  - [ ]* 6.7 Write property test for Recurring Expense Detection
    - **Property 14: Recurring Expense Detection**
    - For repeating expense patterns, verify correct frequency detection
    - **Validates: Requirements 4.3**

  - [ ]* 6.8 Write property test for Trend Spike Warning Trigger
    - **Property 15: Trend Spike Warning Trigger**
    - For >20% increase vs 3-month average, verify warning with correct category and changePercentage
    - **Validates: Requirements 4.4**

  - [ ]* 6.9 Write property test for Prediction Confidence Range Invariant
    - **Property 16: Prediction Confidence Range Invariant**
    - For any prediction output, verify confidence ∈ [0.0, 1.0]
    - **Validates: Requirements 4.5**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Financial planner module
  - [x] 8.1 Implement expense-to-income ratio calculation
    - Create `functions/src/services/financialPlanner.ts`
    - Implement `calculateExpenseRatio(userId, month)` returning `ExpenseRatio`
    - Set `isHealthy: false` when ratio > 0.7, generate cost reduction suggestions
    - Handle `monthlyIncome === null` gracefully (skip ratio calculation)
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 8.2 Implement budget plan generation
    - Implement `generateBudgetPlan(userId)` using historical data + trend predictions
    - Implement `calculateBudgetFromSavingsGoal(userId, savingsGoal)` ensuring totalBudget ≤ income - savingsGoal
    - Implement `forecastExpenses(userId, months)` for N-month forecasts
    - Auto-update budget plan `lastUpdated` when new expenses arrive
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 8.3 Implement cost reduction suggestions
    - Implement `suggestCostReduction(userId)` comparing categories against historical averages
    - Ensure suggestedBudget < currentAverage and potentialSaving > 0
    - _Requirements: 7.3_

  - [x] 8.4 Implement expense ratio history
    - Add endpoint to retrieve expense-to-income ratio for past 6 months
    - _Requirements: 6.4_

  - [ ]* 8.5 Write property test for Expense Ratio Calculation and Warning
    - **Property 20: Expense Ratio Calculation and Warning**
    - Verify ratio = totalExpense / totalIncome, and ratio > 0.7 → isHealthy = false
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 8.6 Write property test for Income Storage Round-Trip
    - **Property 21: Income Storage Round-Trip**
    - Store monthlyIncome, retrieve user → same value returned
    - **Validates: Requirements 6.1**

  - [ ]* 8.7 Write property test for Budget Plan Category Coverage
    - **Property 22: Budget Plan Category Coverage**
    - Budget plan covers all active categories, sum of categoryBudgets ≤ totalBudget
    - **Validates: Requirements 7.1**

  - [ ]* 8.8 Write property test for Forecast Completeness
    - **Property 23: Forecast Completeness**
    - Forecast for N months returns exactly N months with all active categories
    - **Validates: Requirements 7.2**

  - [ ]* 8.9 Write property test for Cost Reduction Suggestions Validity
    - **Property 24: Cost Reduction Suggestions Validity**
    - Verify suggestedBudget < currentAverage and potentialSaving > 0
    - **Validates: Requirements 7.3**

  - [ ]* 8.10 Write property test for Savings Goal Budget Calculation
    - **Property 25: Savings Goal Budget Calculation**
    - Verify totalBudget ≤ income - savingsGoal
    - **Validates: Requirements 7.4**

  - [ ]* 8.11 Write property test for Budget Plan Auto-Update on New Expense
    - **Property 26: Budget Plan Auto-Update on New Expense**
    - Adding new expense changes budget plan's lastUpdated timestamp
    - **Validates: Requirements 7.5**

- [x] 9. Notification service
  - [x] 9.1 Implement notification service with FCM integration
    - Create `functions/src/services/notificationService.ts`
    - Implement `sendBillDueReminder` (7 days before monthly/quarterly, 30 days before yearly)
    - Implement `sendExpenseWarning` for predicted >15% spike
    - Implement `sendBudgetAlert` when spending ≥ 80% of budget
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 9.2 Implement notification preferences
    - Implement `getNotificationPreferences` and `updateNotificationPreferences`
    - Support push and email channels with configurable frequency
    - Store preferences in Firestore `users` or dedicated `notificationPreferences` collection
    - _Requirements: 5.5_

  - [ ]* 9.3 Write property test for Notification Timing Based on Due Date
    - **Property 17: Notification Timing Based on Due Date**
    - Verify 7-day lead for monthly/quarterly, 30-day lead for yearly, with correct bill details
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 9.4 Write property test for Predicted Expense Spike Notification
    - **Property 18: Predicted Expense Spike Notification**
    - For >15% predicted increase, verify notification generated with details
    - **Validates: Requirements 5.2**

  - [ ]* 9.5 Write property test for Budget Threshold Alert
    - **Property 19: Budget Threshold Alert**
    - When spending ≥ 80% of budget, verify alert triggered
    - **Validates: Requirements 5.4**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Dashboard and expense query services
  - [x] 11.1 Implement dashboard data aggregation endpoint
    - Add Cloud Function endpoint that returns: monthly total by category, pie chart data, bar chart data (6 months)
    - Ensure category sums equal monthly total (Property 9)
    - Target < 3 second response time
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 11.2 Implement category filter and detail endpoint
    - Add endpoint to filter expenses by category, returning only matching records
    - _Requirements: 3.3_

  - [x] 11.3 Implement expense-to-income ratio for dashboard
    - Wire `calculateExpenseRatio` into dashboard response
    - Hide ratio card when `monthlyIncome === null`
    - _Requirements: 3.4, 6.5_

  - [ ]* 11.4 Write property test for Dashboard Category Sum Equals Total
    - **Property 9: Dashboard Category Sum Equals Total**
    - Sum of category amounts = total monthly expense
    - **Validates: Requirements 3.1**

  - [ ]* 11.5 Write property test for Category Filter Returns Correct Expenses
    - **Property 10: Category Filter Returns Correct Expenses**
    - Filtering by category returns only matching records with correct count
    - **Validates: Requirements 3.3**

  - [ ]* 11.6 Write property test for Historical Data Completeness
    - **Property 11: Historical Data Completeness**
    - Querying N months returns exactly N data points with no gaps
    - **Validates: Requirements 3.2, 6.4**

- [x] 12. Authentication and security
  - [x] 12.1 Verify auth service and middleware
    - Ensure `authMiddleware.ts` validates JWT on all protected routes
    - Ensure every Firestore query scopes to authenticated `userId` (prevent IDOR)
    - Verify signup/login flow works with Firebase Auth or custom JWT
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 12.2 Implement account deletion
    - Add `deleteAccount(userId)` endpoint that removes all user data from expenses, budgets, notifications collections
    - Clean up Firebase Storage files (bill images) for the user
    - _Requirements: 8.5_

  - [ ]* 12.3 Write property test for Account Deletion Data Removal
    - **Property 27: Account Deletion Data Removal**
    - After deletion, querying all collections with userId returns empty results
    - **Validates: Requirements 8.5**

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Mobile app - Dashboard UI
  - [x] 14.1 Implement Dashboard screen with summary cards
    - Update `billbuddy/app/(tabs)/index.tsx` with dark theme layout
    - Implement month summary card (total expenses + trend indicator) and remaining budget card
    - Use theme tokens from `billbuddy/constants/theme.ts` matching design color palette
    - _Requirements: 3.1, 3.5_

  - [x] 14.2 Implement expense pie chart component
    - Update `billbuddy/components/dashboard/ExpensePieChart.tsx` with donut chart showing category breakdown
    - Use category colors from design (electricity=orange, water=blue, insurance=pink, loan=red, gas=green, manual=purple)
    - Make categories tappable to navigate to detail view
    - _Requirements: 3.1, 3.3_

  - [x] 14.3 Implement monthly bar chart component
    - Update `billbuddy/components/dashboard/MonthSummary.tsx` with 6-month bar chart
    - Highlight current month with `accent.green`, others with `text.muted`
    - Display Thai month abbreviations
    - _Requirements: 3.2_

  - [x] 14.4 Implement expense-to-income ratio card
    - Implement ratio display with progress indicator and health status (green ≤70%, orange 70-90%, red >90%)
    - Conditionally hide when `monthlyIncome === null`
    - _Requirements: 3.4, 6.5_

  - [x] 14.5 Implement prediction card component
    - Update `billbuddy/components/dashboard/PredictionCard.tsx` to show upcoming bill predictions with confidence
    - _Requirements: 4.5, 5.1_

- [x] 15. Mobile app - Camera and extraction flow
  - [x] 15.1 Implement camera screen for bill capture
    - Update `billbuddy/app/(tabs)/camera.tsx` with camera integration
    - Upload captured image to Firebase Storage, trigger extraction Cloud Function
    - Show loading state during extraction (< 15 seconds target)
    - _Requirements: 1.2_

  - [x] 15.2 Implement extraction review screen
    - Update `billbuddy/components/forms/ExtractionReview.tsx`
    - Display extracted data (amount, category, dueDate) with confidence indicators
    - Allow user to edit fields before confirming
    - Show error message with retake tips for low-quality images
    - _Requirements: 1.3, 1.4_

  - [x] 15.3 Implement manual expense entry form
    - Update `billbuddy/components/forms/ManualExpenseForm.tsx`
    - Support category selection (including custom categories), amount, date, paid status
    - _Requirements: 2.4_

- [x] 16. Mobile app - Settings and account management
  - [x] 16.1 Implement settings screen
    - Update `billbuddy/app/(tabs)/settings.tsx` with income input, notification preferences, account management
    - Wire income update to backend (store `monthlyIncome` on user record)
    - _Requirements: 5.5, 6.1_

  - [x] 16.2 Implement auth screens
    - Update `billbuddy/app/(auth)/login.tsx` and `signup.tsx` with dark theme styling
    - Wire to auth service endpoints
    - _Requirements: 8.2, 8.3_

- [x] 17. Mobile app - State management and API integration
  - [x] 17.1 Wire Zustand stores to Firebase/API endpoints
    - Update `billbuddy/store/expenseStore.ts` to call Cloud Function endpoints for CRUD
    - Update `billbuddy/store/authStore.ts` to handle JWT token storage and refresh
    - Update `billbuddy/store/incomeStore.ts` to sync monthly income
    - _Requirements: 6.1, 8.1_

  - [x] 17.2 Implement custom hooks for data fetching
    - Update `billbuddy/hooks/useDashboard.ts` to aggregate dashboard data from API
    - Update `billbuddy/hooks/useExpenses.ts` for expense CRUD with filters
    - Update `billbuddy/hooks/useExtraction.ts` for extraction flow state management
    - Update `billbuddy/hooks/usePrediction.ts` for prediction data
    - _Requirements: 3.5, 4.5_

- [x] 18. Integration wiring and API routes
  - [x] 18.1 Wire all backend services into Cloud Function routes
    - Add routes for: dashboard aggregation, budget CRUD, notification preferences, financial planning, account deletion
    - Ensure all routes use auth middleware and userId scoping
    - Connect categorization service into expense creation pipeline (extract → categorize → store)
    - _Requirements: 1.1, 1.2, 2.1, 8.1_

  - [x] 18.2 Implement scheduled Cloud Functions
    - Add scheduled function for daily notification checks (bill due reminders, budget alerts)
    - Add scheduled function for weekly trend analysis updates
    - _Requirements: 5.1, 5.3, 7.5_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check library with minimum 100 iterations each
- The backend uses in-memory stores (via `FirestoreStore` abstraction) for development/testing, swappable to real Firestore
- All API responses follow `{ data: ..., error: ... }` format per `ApiResponse<T>`
