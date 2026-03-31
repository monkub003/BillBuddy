# Requirements Document

## Introduction

BillBuddy is an AI-powered mobile application for tracking domestic expenses (electricity, water, insurance, subscriptions, loans, car installments, gas, etc.). The MVP (v1.0.0) provides user authentication, manual and AI-automated expense entry (via camera OCR and email parsing), expense categorization, a visual financial dashboard, and predictive financial analysis using external data sources. The application targets individual users who want a consolidated, intelligent view of their household bills and spending patterns.

## Glossary

- **App**: The BillBuddy React Native mobile application running on iOS and Android.
- **Backend**: The Firebase-based server infrastructure including Firestore, Cloud Functions, and authentication services.
- **Auth_Service**: The authentication module responsible for user signup, login, JWT token issuance, and session management.
- **Expense_Service**: The backend module responsible for creating, reading, updating, and deleting expense records in Firestore.
- **OCR_Extractor**: The AI-powered Cloud Function that processes camera-captured images of bills and receipts to extract structured expense data.
- **Email_Extractor**: The AI-powered Cloud Function that processes forwarded email receipts to extract structured expense data.
- **Prediction_Engine**: The AI module that analyzes historical expense data combined with external factors (weather, economic indicators, exchange rates) to forecast future expenses.
- **Dashboard**: The main visual interface displaying charts, summaries, and financial status to the user.
- **Expense_Record**: A single expense entry in Firestore conforming to the Expense schema (id, user_id, category, amount, currency, due_date, is_paid, extracted_via, raw_source_ref, created_at).
- **Confidence_Score**: A numeric value (0.0 to 1.0) returned by AI extraction services indicating the reliability of the extracted data.
- **THB**: Thai Baht, the default currency used in the application.

## Requirements

### Requirement 1: User Signup

**User Story:** As a new user, I want to create an account with my email and password, so that I can securely access BillBuddy.

#### Acceptance Criteria

1. WHEN a user submits a valid email and password, THE Auth_Service SHALL create a new user record in Firestore with a bcrypt-hashed password and return a JWT token.
2. WHEN a user submits an email that already exists in the system, THE Auth_Service SHALL reject the signup request and return an "email already registered" error.
3. WHEN a user submits a password shorter than 8 characters, THE Auth_Service SHALL reject the signup request and return a "password too short" error.
4. WHEN a user submits an invalid email format, THE Auth_Service SHALL reject the signup request and return an "invalid email" error.
5. THE Auth_Service SHALL store only the bcrypt-hashed password and never persist the plaintext password.

### Requirement 2: User Login

**User Story:** As a returning user, I want to log in with my email and password, so that I can access my expense data.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Service SHALL verify the password against the stored bcrypt hash and return a JWT token.
2. WHEN a user submits an incorrect password, THE Auth_Service SHALL reject the login request and return an "invalid credentials" error.
3. WHEN a user submits an email that does not exist, THE Auth_Service SHALL reject the login request and return an "invalid credentials" error.
4. THE Auth_Service SHALL include the user_id in the JWT token payload for downstream authorization.

### Requirement 3: JWT Authentication Enforcement

**User Story:** As a user, I want all my data requests to be authenticated, so that my financial data remains secure.

#### Acceptance Criteria

1. THE Backend SHALL verify the JWT token on every incoming API request before processing the request.
2. WHEN a request contains an expired or invalid JWT token, THE Backend SHALL reject the request with a 401 Unauthorized status.
3. WHEN a request contains no JWT token, THE Backend SHALL reject the request with a 401 Unauthorized status.
4. THE Backend SHALL scope every Firestore query to the authenticated user_id extracted from the JWT token.

### Requirement 4: Manual Expense Entry

**User Story:** As a user, I want to manually enter an expense, so that I can track bills that are not available digitally.

#### Acceptance Criteria

1. WHEN a user submits a manual expense with category, amount, due_date, and is_paid status, THE Expense_Service SHALL create an Expense_Record with extracted_via set to "manual".
2. THE App SHALL provide a form with fields for category (selectable from: electricity, water, insurance, loan, gas, manual), amount (numeric), due_date (date picker), and is_paid (toggle).
3. WHEN a user submits an expense with a non-positive amount, THE Expense_Service SHALL reject the entry and return an "amount must be positive" error.
4. THE Expense_Service SHALL set the currency field to "THB" for all manually created Expense_Records.
5. WHEN a manual expense is successfully created, THE App SHALL display a confirmation message and navigate the user back to the Dashboard.

### Requirement 5: AI Expense Extraction from Camera Images

**User Story:** As a user, I want to take a photo of a bill or receipt, so that BillBuddy can automatically extract the expense details.

#### Acceptance Criteria

1. WHEN a user captures or selects an image, THE App SHALL upload the image to Firebase Storage via a secure, authenticated connection.
2. WHEN an image is uploaded, THE OCR_Extractor SHALL process the image and extract the amount, category, and due_date into a structured Expense_Record.
3. THE OCR_Extractor SHALL return a Confidence_Score between 0.0 and 1.0 for each extracted field.
4. WHEN the OCR_Extractor returns a Confidence_Score below 0.5 for any field, THE App SHALL highlight the low-confidence field and prompt the user to review and correct the value.
5. WHEN the OCR_Extractor successfully extracts data, THE Expense_Service SHALL create an Expense_Record with extracted_via set to "image" and raw_source_ref set to the Firebase Storage URL.
6. IF the OCR_Extractor cannot read the image, THEN THE OCR_Extractor SHALL return a descriptive error message indicating the image is unreadable.
7. THE Backend SHALL delete the uploaded image from Firebase Storage within 24 hours after extraction to minimize PII retention.

### Requirement 6: AI Expense Extraction from Email Receipts

**User Story:** As a user, I want to forward email receipts to BillBuddy, so that expense details are automatically extracted.

#### Acceptance Criteria

1. WHEN an email receipt is received via webhook, THE Email_Extractor SHALL parse the email body and attachments to extract amount, category, and due_date.
2. THE Email_Extractor SHALL return a Confidence_Score between 0.0 and 1.0 for each extracted field.
3. WHEN the Email_Extractor returns a Confidence_Score below 0.5 for any field, THE App SHALL highlight the low-confidence field and prompt the user to review and correct the value.
4. WHEN the Email_Extractor successfully extracts data, THE Expense_Service SHALL create an Expense_Record with extracted_via set to "email" and raw_source_ref set to the email identifier.
5. IF the Email_Extractor cannot parse the email content, THEN THE Email_Extractor SHALL return a descriptive error message indicating the email format is unsupported.
6. THE Email_Extractor SHALL scrub any PII from the raw email content before storing the reference.

### Requirement 7: AI Extraction Data Mapping (Parser)

**User Story:** As a developer, I want the AI extraction output to be reliably mapped to the Expense interface, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN the OCR_Extractor or Email_Extractor returns raw extraction output, THE Backend SHALL parse the output into a valid Expense_Record conforming to the Expense TypeScript interface.
2. THE Backend SHALL validate that the parsed amount is a positive number, category is one of the allowed values (electricity, water, insurance, loan, gas, manual), and due_date is a valid date.
3. IF the parsed data contains an unrecognized category, THEN THE Backend SHALL assign the category "manual" and flag the record for user review.
4. THE Expense_Serializer SHALL format Expense_Record objects into valid JSON matching the Firestore expense schema.
5. FOR ALL valid Expense_Record objects, parsing the serialized JSON back into an Expense_Record SHALL produce an equivalent object (round-trip property).

### Requirement 8: Expense Categorization

**User Story:** As a user, I want my expenses to be categorized, so that I can understand my spending by type.

#### Acceptance Criteria

1. THE Expense_Service SHALL support the following categories: electricity, water, insurance, loan, gas, and manual.
2. WHEN an AI extractor identifies a bill type, THE Backend SHALL map the identified type to one of the supported categories.
3. WHEN the AI extractor cannot determine the category, THE Backend SHALL assign the "manual" category and prompt the user to select the correct category.
4. THE App SHALL allow the user to change the category of any Expense_Record after creation.

### Requirement 9: Visual Dashboard

**User Story:** As a user, I want to see a visual dashboard of my financial status, so that I can quickly understand my spending patterns.

#### Acceptance Criteria

1. THE Dashboard SHALL display a summary of total expenses for the current month.
2. THE Dashboard SHALL display a pie chart or bar chart showing expense distribution by category.
3. THE Dashboard SHALL display a list of upcoming unpaid bills sorted by due_date in ascending order.
4. THE Dashboard SHALL display the total paid versus unpaid amounts for the current month.
5. WHEN the user has no expenses recorded, THE Dashboard SHALL display an empty state message guiding the user to add their first expense.
6. WHEN new Expense_Records are created, THE Dashboard SHALL reflect the updated data within 5 seconds of navigating to the Dashboard screen.

### Requirement 10: Predictive Financial Analysis

**User Story:** As a user, I want BillBuddy to predict my future expenses, so that I can plan my budget proactively.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL analyze the user's historical expense data (minimum 1 month of records) to generate predictions for the next month.
2. THE Prediction_Engine SHALL incorporate weather data (via Weather API) as a factor for utility-related expense predictions (electricity, water, gas).
3. THE Prediction_Engine SHALL incorporate economic indicators (via external API) as a factor for insurance and loan-related expense predictions.
4. THE Prediction_Engine SHALL incorporate exchange rate data (via Exchange Rate API) when the user has expenses affected by currency fluctuations.
5. WHEN the Prediction_Engine generates a forecast, THE Prediction_Engine SHALL return a predicted amount range (minimum and maximum) for each expense category.
6. WHEN the user has fewer than 1 month of historical data, THE Prediction_Engine SHALL display a message indicating insufficient data for predictions.
7. IF an external data source (weather, economic, exchange rate API) is unavailable, THEN THE Prediction_Engine SHALL generate predictions using only available data and indicate which factors were excluded.

### Requirement 11: Income/Expense Compatibility Analysis

**User Story:** As a user, I want to understand whether my income covers my expenses, so that I can manage my finances responsibly.

#### Acceptance Criteria

1. THE App SHALL allow the user to input their monthly income amount.
2. WHEN the user has set a monthly income, THE Dashboard SHALL display the income-to-expense ratio for the current month.
3. WHEN total expenses exceed 90% of the monthly income, THE App SHALL display a warning notification to the user.
4. WHEN total expenses exceed 100% of the monthly income, THE App SHALL display a critical alert indicating overspending.
5. THE Dashboard SHALL display a visual indicator (color-coded) showing the income versus expense balance status.

### Requirement 12: Data Isolation and Security

**User Story:** As a user, I want my financial data to be private and secure, so that no other user can access my information.

#### Acceptance Criteria

1. THE Backend SHALL scope every database read and write operation to the authenticated user_id.
2. THE Backend SHALL reject any request that attempts to access an Expense_Record belonging to a different user_id with a 403 Forbidden status.
3. THE App SHALL transmit all data over HTTPS.
4. THE Backend SHALL validate and sanitize all user inputs before writing to Firestore.
5. WHEN a user uploads an image for extraction, THE Backend SHALL restrict access to the uploaded file to the authenticated user only.

### Requirement 13: Standardized API Responses

**User Story:** As a developer, I want all API responses to follow a consistent format, so that the frontend can handle responses predictably.

#### Acceptance Criteria

1. THE Backend SHALL return all API responses in the format: `{ "data": <payload>, "error": <error_message_or_null> }`.
2. WHEN a request is successful, THE Backend SHALL set the "error" field to null and populate the "data" field.
3. WHEN a request fails, THE Backend SHALL set the "data" field to null and populate the "error" field with a descriptive message.
4. THE Backend SHALL return appropriate HTTP status codes: 200 for success, 400 for validation errors, 401 for authentication errors, 403 for authorization errors, and 500 for server errors.
