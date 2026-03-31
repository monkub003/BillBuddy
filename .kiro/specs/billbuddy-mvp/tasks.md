# Implementation Plan: BillBuddy MVP

## Overview

Incremental implementation of the BillBuddy AI-powered expense tracking app. The plan starts with shared types and backend infrastructure (auth, expenses, extractors, predictions), then builds the React Native frontend (auth screens, dashboard, camera, settings), and finishes by wiring everything together with integration tests. All code is TypeScript. Backend runs on Firebase Cloud Functions (Express). Frontend uses Expo Router, Zustand, and NativeWind.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize backend project structure (`functions/`) with TypeScript, Express, Firebase Admin SDK, Jest, and fast-check
    - Create `functions/package.json`, `functions/tsconfig.json`
    - Install dependencies: express, firebase-admin, bcryptjs, jsonwebtoken, fast-check, jest, ts-jest, supertest
    - Create directory structure: `functions/src/services/`, `functions/src/extractors/`, `functions/src/middleware/`, `functions/src/types/`, `functions/tests/`
    - _Requirements: 13.1_

  - [x] 1.2 Initialize frontend project structure (`billbuddy/`) with Expo, TypeScript, Zustand, and NativeWind
    - Create Expo project with Expo Router
    - Install dependencies: zustand, nativewind, react-native-chart-kit (or victory-native), expo-camera, expo-image-picker
    - Create directory structure per AGENTS.md frontend structure
    - _Requirements: 9.1_

  - [x] 1.3 Define shared TypeScript types and interfaces
    - Create `functions/src/types/api.ts` — `ApiResponse<T>`, `ExpenseCategory`, `ExtractionSource`
    - Create `functions/src/types/expense.ts` — `Expense`, `CreateExpenseInput`, `ExpenseFilters`
    - Create `functions/src/types/user.ts` — `User`
    - Create `functions/src/types/prediction.ts` — `PredictionResult`, `PredictionContext`
    - Create `functions/src/types/extraction.ts` — `ExtractionResult`, `ExtractionFieldResult`, `EmailWebhookPayload`, `ValidationResult`
    - Mirror shared types in `billbuddy/types/`
    - _Requirements: 7.1, 7.4, 13.1_

  - [x] 1.4 Create Docker Compose configuration for local development
    - Create `docker-compose.yml` with Firebase Emulator Suite (Firestore, Storage, Functions)
    - Create backend `.env` file with placeholder secrets per AGENTS.md
    - Create frontend `.env` file per AGENTS.md
    - _Requirements: 12.3_

- [x] 2. Authentication service and middleware
  - [x] 2.1 Implement Auth Service (`functions/src/services/authService.ts`)
    - Implement `signup(email, password)`: validate email format, enforce password ≥ 8 chars, check duplicate email, bcrypt hash password, store user in Firestore, return JWT
    - Implement `login(email, password)`: verify credentials against bcrypt hash, return JWT with user_id in payload
    - Implement `verifyToken(token)`: decode and verify JWT, return user_id
    - Use generic "invalid credentials" error for both wrong email and wrong password to prevent user enumeration
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Write property tests for Auth Service
    - **Property 1: Signup produces bcrypt hash, never plaintext**
    - **Validates: Requirements 1.1, 1.5**

  - [x] 2.3 Write property tests for Auth Service — short passwords
    - **Property 2: Short passwords are rejected**
    - **Validates: Requirements 1.3**

  - [x] 2.4 Write property tests for Auth Service — invalid emails
    - **Property 3: Invalid emails are rejected**
    - **Validates: Requirements 1.4**

  - [x] 2.5 Write property tests for Auth Service — duplicate emails
    - **Property 4: Duplicate email signup is rejected**
    - **Validates: Requirements 1.2**

  - [x] 2.6 Write property tests for Auth Service — signup-then-login round trip
    - **Property 5: Signup-then-login round trip**
    - **Validates: Requirements 2.1, 2.4**

  - [x] 2.7 Write property tests for Auth Service — invalid credentials
    - **Property 6: Login with invalid credentials fails**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 2.8 Implement JWT authentication middleware (`functions/src/middleware/authMiddleware.ts`)
    - Extract JWT from Authorization header
    - Verify token validity and expiration
    - Attach `userId` to request context
    - Return 401 for missing, expired, or invalid tokens
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.9 Write property tests for JWT middleware
    - **Property 7: Invalid or missing JWT returns 401**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.10 Implement auth API routes (`functions/src/routes/authRoutes.ts`)
    - POST `/auth/signup` — calls authService.signup, returns `{ data, error }` envelope
    - POST `/auth/login` — calls authService.login, returns `{ data, error }` envelope
    - Wire routes into Express app without auth middleware
    - _Requirements: 1.1, 2.1, 13.1, 13.2, 13.3, 13.4_

- [x] 3. Checkpoint — Auth service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Expense service and data layer
  - [x] 4.1 Implement Expense Service (`functions/src/services/expenseService.ts`)
    - Implement `createExpense(userId, data)`: validate amount > 0, validate category, enforce currency = "THB", set extracted_via, store in Firestore
    - Implement `getExpenses(userId, filters?)`: query scoped to userId, support filtering by category, month/year, isPaid
    - Implement `updateExpense(userId, expenseId, data)`: verify ownership, update fields
    - Implement `deleteExpense(userId, expenseId)`: verify ownership, delete record
    - Return 403 if expense belongs to a different user
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.4, 12.1, 12.2_

  - [x] 4.2 Write property tests for Expense Service — extracted_via source
    - **Property 9: Extracted_via matches source channel**
    - **Validates: Requirements 4.1, 5.5, 6.4**

  - [x] 4.3 Write property tests for Expense Service — non-positive amounts
    - **Property 10: Non-positive amounts are rejected**
    - **Validates: Requirements 4.3**

  - [x] 4.4 Write property tests for Expense Service — currency enforcement
    - **Property 11: Currency is always THB**
    - **Validates: Requirements 4.4**

  - [x] 4.5 Write property tests for data isolation
    - **Property 8: Data isolation between users**
    - **Validates: Requirements 3.4, 12.1, 12.2**

  - [x] 4.6 Implement expense API routes (`functions/src/routes/expenseRoutes.ts`)
    - POST `/expenses` — create expense
    - GET `/expenses` — list expenses with optional query filters
    - PUT `/expenses/:id` — update expense
    - DELETE `/expenses/:id` — delete expense
    - All routes behind auth middleware, scoped to userId
    - _Requirements: 4.1, 12.1, 13.1, 13.4_

  - [x] 4.7 Set up Firestore indexes
    - Create `firestore.indexes.json` with composite indexes: `(user_id, due_date)`, `(user_id, category, created_at)`, `(user_id, is_paid, due_date)`
    - _Requirements: 9.3_

- [x] 5. Checkpoint — Expense service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. AI extraction pipeline
  - [x] 6.1 Implement Data Mapper (`functions/src/extractors/dataMapper.ts`)
    - Implement `mapToExpense(raw, userId, source, sourceRef)`: map ExtractionResult to Expense, default unrecognized categories to "manual" with needsReview=true
    - Implement `validateExpenseData(data)`: validate amount > 0, category in allowed set, dueDate is valid date
    - Implement `serializeExpense(expense)` and `deserializeExpense(json)` for round-trip serialization
    - Set `needsReview = true` when any confidence < 0.5
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3_

  - [x] 6.2 Write property tests for Data Mapper — valid expense output
    - **Property 14: Data mapper produces valid Expense records**
    - **Validates: Requirements 7.1, 7.2, 8.1**

  - [x] 6.3 Write property tests for Data Mapper — unrecognized categories
    - **Property 15: Unrecognized categories default to "manual" with review flag**
    - **Validates: Requirements 7.3, 8.3**

  - [x] 6.4 Write property tests for Data Mapper — serialization round trip
    - **Property 16: Expense serialization round trip**
    - **Validates: Requirements 7.4, 7.5**

  - [x] 6.5 Implement OCR Extractor (`functions/src/extractors/ocrExtractor.ts`)
    - Cloud Function triggered by Firebase Storage upload
    - Process image via AI service (AI_SERVICE_API_KEY), extract amount, category, dueDate with confidence scores
    - Pass result through Data Mapper to create Expense_Record
    - Handle unreadable images with descriptive error
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [x] 6.6 Implement Email Extractor (`functions/src/extractors/emailExtractor.ts`)
    - Cloud Function triggered by email webhook
    - Parse email body and attachments, extract amount, category, dueDate with confidence scores
    - Pass result through Data Mapper to create Expense_Record
    - Scrub PII from raw email content before storing reference
    - Handle unparseable emails with descriptive error
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [x] 6.7 Write property tests for extraction confidence scores
    - **Property 12: Extraction confidence scores are bounded**
    - **Validates: Requirements 5.3, 6.2**

  - [x] 6.8 Write property tests for low confidence review flagging
    - **Property 13: Low confidence fields are flagged for review**
    - **Validates: Requirements 5.4, 6.3**

- [x] 7. Checkpoint — Extraction pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Prediction engine
  - [x] 8.1 Implement Prediction Engine (`functions/src/services/predictionEngine.ts`)
    - Implement `generatePredictions(userId)`: query historical expenses, fetch external data (weather, economic, exchange rate), compute predicted min/max ranges per category
    - Implement `hasEnoughData(userId)`: check for ≥ 1 month of historical data
    - Handle external API failures gracefully — continue with available data, report excluded factors
    - Return insufficient data indicator when < 1 month of history
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 8.2 Write property tests for prediction range invariant
    - **Property 20: Prediction range invariant**
    - **Validates: Requirements 10.5**

  - [x] 8.3 Write property tests for insufficient data handling
    - **Property 21: Insufficient data returns no predictions**
    - **Validates: Requirements 10.6**

  - [x] 8.4 Write property tests for external factor degradation
    - **Property 22: External factor degradation**
    - **Validates: Requirements 10.7**

  - [x] 8.5 Write property tests for external factors influencing categories
    - **Property 23: External factors influence respective categories**
    - **Validates: Requirements 10.2, 10.3, 10.4**

  - [x] 8.6 Implement prediction API route (`functions/src/routes/predictionRoutes.ts`)
    - GET `/predictions` — calls predictionEngine.generatePredictions, returns `{ data, error }` envelope
    - Behind auth middleware
    - _Requirements: 10.1, 13.1_

- [x] 9. API response envelope and income endpoint
  - [x] 9.1 Implement API response helper and error handler middleware (`functions/src/middleware/responseHelper.ts`)
    - Centralized `{ data, error }` envelope wrapper
    - Error handler middleware mapping error types to HTTP status codes (400, 401, 403, 500)
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 9.2 Write property tests for API response envelope
    - **Property 25: API response envelope conformance**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x] 9.3 Write property tests for HTTP status codes
    - **Property 26: HTTP status codes match error types**
    - **Validates: Requirements 13.4**

  - [x] 9.4 Implement income endpoint (`functions/src/routes/userRoutes.ts`)
    - PUT `/users/income` — update monthly_income for authenticated user
    - GET `/users/me` — return current user profile including monthly_income
    - Behind auth middleware
    - _Requirements: 11.1_

  - [x] 9.5 Implement income/expense alert logic (`functions/src/services/alertService.ts`)
    - Calculate income-to-expense ratio for current month
    - Return warning when expenses > 90% of income, critical alert when > 100%
    - Return no alert when ≤ 90%
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [x] 9.6 Write property tests for income/expense alert thresholds
    - **Property 24: Income-to-expense alert thresholds**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**

  - [x] 9.7 Wire all routes into Express app entry point (`functions/src/index.ts`)
    - Mount authRoutes, expenseRoutes, predictionRoutes, userRoutes
    - Apply auth middleware to protected routes
    - Apply error handler middleware
    - Export as Firebase Cloud Function
    - _Requirements: 3.1, 13.1_

- [x] 10. Checkpoint — Full backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend — Auth screens and state management
  - [x] 11.1 Set up Zustand stores (`billbuddy/store/`)
    - Create `authStore.ts` — JWT token, current user, login/signup/logout actions
    - Create `expenseStore.ts` — expense list, filters, loading states, CRUD actions
    - Create `incomeStore.ts` — monthly income, alert status
    - _Requirements: 2.1, 4.1, 11.1_

  - [x] 11.2 Create API client module (`billbuddy/lib/api.ts`)
    - Centralized fetch wrapper that attaches JWT from authStore
    - Parse `{ data, error }` envelope, throw on error
    - Handle 401 by clearing auth store and redirecting to login
    - _Requirements: 3.1, 13.1_

  - [x] 11.3 Create Firebase initialization (`billbuddy/lib/firebase.ts`)
    - Initialize Firebase app with env config
    - Export storage reference for image uploads
    - _Requirements: 5.1_

  - [x] 11.4 Implement auth screens
    - Create `app/(auth)/login.tsx` — email/password form, call login API, store JWT
    - Create `app/(auth)/signup.tsx` — email/password form with validation (email format, password ≥ 8 chars), call signup API, store JWT
    - Create `app/_layout.tsx` — root layout with auth guard, redirect to login if no token
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 4.5_

  - [x] 11.5 Implement `useAuth` hook (`billbuddy/hooks/useAuth.ts`)
    - Wrap authStore actions: login, signup, logout
    - Handle loading and error states
    - _Requirements: 1.1, 2.1_

- [x] 12. Frontend — Dashboard and expense management
  - [x] 12.1 Implement `useExpenses` hook (`billbuddy/hooks/useExpenses.ts`)
    - Fetch expenses from API with filter support
    - CRUD operations via expenseStore
    - _Requirements: 4.1, 9.1_

  - [x] 12.2 Implement Dashboard screen (`app/(tabs)/index.tsx`)
    - Display monthly expense summary (total paid vs unpaid)
    - Display category distribution chart (pie/bar chart)
    - Display upcoming unpaid bills sorted by due_date ascending
    - Display empty state when no expenses exist
    - Refresh data on screen focus
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 12.3 Write property tests for dashboard data aggregation
    - **Property 17: Unpaid bills are sorted by due date ascending**
    - **Validates: Requirements 9.3**

  - [x] 12.4 Write property tests for dashboard totals
    - **Property 18: Paid plus unpaid equals monthly total**
    - **Validates: Requirements 9.1, 9.4**

  - [x] 12.5 Write property tests for category distribution
    - **Property 19: Category distribution sums to total**
    - **Validates: Requirements 9.2**

  - [x] 12.6 Implement Dashboard sub-components
    - Create `components/dashboard/ExpensePieChart.tsx` — category distribution chart
    - Create `components/dashboard/MonthSummary.tsx` — total paid/unpaid, income ratio
    - Create `components/dashboard/UpcomingBills.tsx` — sorted unpaid bills list
    - Create `components/dashboard/PredictionCard.tsx` — predicted expense ranges
    - Create `components/shared/AlertBanner.tsx` — income/expense warning/critical alerts (color-coded)
    - _Requirements: 9.1, 9.2, 9.3, 10.5, 11.2, 11.3, 11.4, 11.5_

  - [x] 12.7 Implement Manual Expense Form (`components/forms/ManualExpenseForm.tsx`)
    - Form with category dropdown, amount input, date picker, is_paid toggle
    - Validate amount > 0 client-side
    - On submit, call createExpense API, show confirmation, navigate to Dashboard
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 12.8 Implement Extraction Review component (`components/forms/ExtractionReview.tsx`)
    - Display extracted fields with confidence indicators
    - Highlight low-confidence fields (< 0.5) for user correction
    - Allow user to edit and confirm extracted values
    - _Requirements: 5.4, 6.3, 8.4_

- [x] 13. Frontend — Camera, predictions, and settings
  - [x] 13.1 Implement Camera screen (`app/(tabs)/camera.tsx`)
    - Camera capture and image picker using expo-camera / expo-image-picker
    - Upload image to Firebase Storage (authenticated)
    - Poll or listen for extraction result
    - Navigate to ExtractionReview on completion
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 13.2 Implement `useExtraction` hook (`billbuddy/hooks/useExtraction.ts`)
    - Handle image upload to Firebase Storage
    - Poll extraction status / listen for result
    - Return extraction result with confidence scores
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 13.3 Implement `usePrediction` hook (`billbuddy/hooks/usePrediction.ts`)
    - Fetch predictions from API
    - Handle insufficient data state
    - _Requirements: 10.1, 10.6_

  - [x] 13.4 Implement `useDashboard` hook (`billbuddy/hooks/useDashboard.ts`)
    - Aggregate expense data for dashboard: totals, category breakdown, upcoming bills
    - Compute income-to-expense ratio and alert level
    - _Requirements: 9.1, 9.2, 9.3, 11.2, 11.3, 11.4_

  - [x] 13.5 Implement Settings screen (`app/(tabs)/settings.tsx`)
    - Monthly income input field with save action
    - Display current income value
    - _Requirements: 11.1_

  - [x] 13.6 Wire tab navigation (`app/(tabs)/_layout.tsx`)
    - Tab bar with Dashboard, Camera, Settings tabs
    - _Requirements: 9.1_

- [x] 14. Checkpoint — Full frontend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Security hardening and image cleanup
  - [x] 15.1 Implement input validation and sanitization middleware (`functions/src/middleware/inputSanitizer.ts`)
    - Sanitize all user inputs before Firestore writes
    - Validate request body schemas on expense and user routes
    - _Requirements: 12.4_

  - [x] 15.2 Implement image cleanup Cloud Function (`functions/src/services/storageCleanup.ts`)
    - Scheduled function to delete uploaded images older than 24 hours from Firebase Storage
    - Restrict storage access to authenticated user only via Firebase Storage security rules
    - _Requirements: 5.7, 12.5_

  - [x] 15.3 Configure Firebase Storage security rules
    - Only authenticated users can upload to their own path
    - Read access restricted to file owner
    - _Requirements: 12.5_

- [x] 16. Final checkpoint — End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (26 total)
- All backend code lives in `functions/src/`, all frontend code in `billbuddy/`
- TypeScript is used throughout both backend and frontend
