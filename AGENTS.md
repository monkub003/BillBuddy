# Project Context for AI Agents & Developers

- **Role:** Expert Senior Mobile & AI Software Engineer

## Project Overview

**Name:** BillBuddy
**Type:** AI-Powered Domestic Expense Tracking Application
**Goal:** MVP (v1.0.0)
**Core Complexity:**
1. **AI Data Extraction:** Parsing unstructured data from email receipts and camera images into structured expense records.
2. **Predictive Financial Analysis:** Utilizing multi-variable external data (weather, economic stats, exchange rates) to predict future expenses.
3. **Data Visualization:** Translating complex financial data into an intuitive dashboard for users.

**About this Project:**
BillBuddy is a mobile application used to track domestic expenses such as electricity bills, water bills, insurance, monthly subscriptions, loans, car installments, gas, etc. It provides users with a visual dashboard of their financial status and utilizes AI to analyze income/expense compatibility, predict future bills, and automate data entry via email and image extraction. Manual entry is also supported for handwritten bills.

## Tech Stack & Architecture

### Backend (Firebase & Node.js)
- **Platform:** Firebase
- **Database:** Firestore (NoSQL) or Firebase Realtime Database
- **Auth:** JWT + bcrypt (Custom Implementation or Firebase Auth wrapper)
- **AI Processing:** Cloud Functions / Microservices for handling predictions and OCR/Extraction logic.
- **Key Architectural Pattern:**
  - **Event-Driven:** AI extractions trigger upon image upload or email webhook receipt.

### Frontend (React Native)
- **Framework:** React Native
- **Language:** TypeScript
- **Styling:** Tailwind CSS (via NativeWind or similar tailored library)
- **State Management:** Context API or Zustand (preferred for global UI state).
- **UI Architecture:** Component-based, mobile-first design prioritizing the visualization dashboard. Do NOT build complex interactive components (modals, dropdowns) from scratch.

### Infrastructure
- **Containerization:** Docker & Docker Compose (for local backend mocking and AI service containerization).
- **Version Control:** Git / GitHub

---

## Configuration & Secrets (.env)

Agents MUST use these exact variable names for connection strings and API keys.

### Backend/AI Services (.env)
```env
PORT=8080
FIREBASE_PROJECT_ID=billbuddy-dev
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@billbuddy-dev.iam.gserviceaccount.com
JWT_SECRET=change_this_to_something_secure
AI_SERVICE_API_KEY=your_openai_or_custom_model_key
EXCHANGE_RATE_API_KEY=your_exchange_api_key
WEATHER_API_KEY=your_weather_api_key
```

### Frontend (.env)
```env
EXPO_PUBLIC_API_URL=http://localhost:8080/
EXPO_PUBLIC_FIREBASE_API_KEY=your_public_firebase_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=billbuddy-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=billbuddy-dev
```

---

## Core Data Schema (Source of Truth)

### Database Schema (Firestore / JSON)
Agents MUST use these structural concepts for NoSQL collections.

```json
// Collection: users
{
  "id": "uuid",
  "email": "user@example.com",
  "password_hash": "hashed_string",
  "created_at": "timestamp"
}

// Collection: expenses
{
  "id": "uuid",
  "user_id": "uuid",
  "category": "electricity | water | insurance | loan | gas | manual",
  "amount": 150.50,
  "currency": "THB",
  "due_date": "timestamp",
  "is_paid": false,
  "extracted_via": "email | image | manual",
  "raw_source_ref": "storage_url_or_email_id",
  "created_at": "timestamp"
}
```

### TypeScript Interfaces (Frontend)
Agents MUST use these types to ensure type safety.

```typescript
interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface Expense {
  id: string;
  userId: string;
  category: string;
  amount: number;
  currency: string;
  dueDate: string;
  isPaid: boolean;
  extractedVia: 'email' | 'image' | 'manual';
  rawSourceRef?: string;
}

interface PredictionContext {
  weatherImpact: string;
  economicFactor: number;
  exchangeRate?: number;
}
```

---

## Build & Test Commands

### Development Environment
- **Start Backend/Infrastructure:** `docker-compose up --build` (Spins up local AI extractors/db emulators)
- **Start React Native App:** `npm start` or `npx expo start`
- **Run on iOS Simulator:** `npm run ios`
- **Run on Android Emulator:** `npm run android`

### Verification
- **Run Unit Tests:** `npm run test`
- **Run Linting:** `npm run lint`

---

## Code Style & Generation Guidelines

### Development Guidelines (TypeScript/React Native)
- **Write idiomatic code** following standard React Native conventions.
- **Extract logic** from UI components into custom hooks.
- **Use strict TypeScript** interfaces for all props and API responses. Avoid `any`.
- **Handle errors explicitly**, especially for AI extractions which are prone to edge cases.

### Backend / AI Services
1. **Error Handling:** AI extraction endpoints must return clear confidence scores and handle unreadable images gracefully.
2. **Standardized Responses:** Use `{ "data": ..., "error": ... }` for all API communications.
3. **Security:** Ensure uploaded images for extraction are temporarily stored and scrubbed if they contain PII (Personally Identifiable Information).

#### Frontend Structure
```text
billbuddy/
├── app/                    # React Native Navigation (Expo Router or React Navigation)
│   ├── (auth)/             # Login/Signup screens
│   ├── (tabs)/             # Main dashboard, Camera, Settings
│   └── _layout.tsx
├── components/
│   ├── dashboard/          # Visualization charts and widgets
│   ├── forms/              # Manual entry forms
│   └── shared/             # Buttons, inputs, modals
├── hooks/                  # Custom hooks (e.g., useExtraction, usePrediction)
├── lib/
│   ├── firebase.ts         # Firebase initialization
│   └── api.ts              # External API calls
├── store/                  # Global state management
├── types/                  # TypeScript definitions
└── tailwind.config.js      # Tailwind customization
```

---

## Security Considerations (Strict Enforcement)

1. **Authentication:**
   - All backend requests MUST verify the JWT token.
2. **Authorization (Data Isolation):**
   - Every database query MUST scope to the authenticated `user_id`.
   - Prevent IDOR: A user cannot access, view, or analyze expenses belonging to another user.
3. **File Handling:**
   - Images uploaded for AI extraction must be securely transmitted and access-restricted.

---

## Testing Instructions for AI Generation

When generating tests, follow this priority:

1. **AI Extraction Logic (Unit Tests):** - *Scenario:* Given a mock JSON response from the OCR/Email parser, verify the application correctly maps the data to the `Expense` interface (identifying amount, date, and category correctly).
2. **Prediction Algorithm (Service Layer):**
   - *Scenario:* Provide mock historical expense data and mock weather/economic modifiers, and verify the prediction algorithm outputs the expected future cost range.
