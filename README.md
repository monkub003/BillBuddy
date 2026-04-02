# BillBuddy

AI-powered domestic expense tracking app built for the Sansiri x AWS Hackathon.

BillBuddy helps users track household bills (electricity, water, insurance, loans, gas, etc.) through manual entry, camera-based OCR extraction, and email receipt parsing. It provides a visual financial dashboard and predictive expense analysis using external data sources.

## Tech Stack

### Backend (`functions/`)
- TypeScript + Express on Firebase Cloud Functions
- Firestore (NoSQL) for data storage
- JWT + bcrypt for authentication
- AI extraction pipeline (OCR + email parsing)
- Prediction engine with weather, economic, and exchange rate factors

### Frontend (`billbuddy/`)
- React Native with Expo + Expo Router
- TypeScript
- Zustand for state management
- NativeWind (Tailwind CSS for React Native)
- react-native-chart-kit for data visualization
- expo-camera + expo-image-picker for bill scanning

### Infrastructure
- Docker Compose with Firebase Emulator Suite
- Firebase Storage for image uploads
- Firebase Storage security rules for access control

## Project Structure

```
├── functions/                  # Backend (Firebase Cloud Functions)
│   ├── src/
│   │   ├── extractors/         # AI extraction pipeline
│   │   │   ├── aiClient.ts     # AI service abstraction
│   │   │   ├── dataMapper.ts   # Extraction → Expense mapping
│   │   │   ├── emailExtractor.ts
│   │   │   └── ocrExtractor.ts
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts    # JWT verification
│   │   │   ├── inputSanitizer.ts    # Input validation & sanitization
│   │   │   └── responseHelper.ts    # API envelope & error handling
│   │   ├── routes/
│   │   │   ├── authRoutes.ts        # POST /auth/signup, /auth/login
│   │   │   ├── expenseRoutes.ts     # CRUD /expenses
│   │   │   ├── predictionRoutes.ts  # GET /predictions
│   │   │   └── userRoutes.ts        # GET /users/me, PUT /users/income
│   │   ├── services/
│   │   │   ├── alertService.ts      # Income/expense alert thresholds
│   │   │   ├── authService.ts       # Signup, login, token verification
│   │   │   ├── expenseService.ts    # Expense CRUD with data isolation
│   │   │   ├── firestore.ts         # Firestore abstraction layer
│   │   │   ├── predictionEngine.ts  # Multi-factor expense forecasting
│   │   │   └── storageCleanup.ts    # Scheduled image cleanup
│   │   ├── types/                   # Shared TypeScript interfaces
│   │   └── index.ts                 # Express app entry point
│   └── tests/
│       ├── unit/                    # Unit tests
│       └── property/                # Property-based tests (fast-check)
│
├── billbuddy/                  # Frontend (React Native / Expo)
│   ├── app/
│   │   ├── (auth)/             # Login & signup screens
│   │   ├── (tabs)/             # Dashboard, camera, settings tabs
│   │   └── _layout.tsx         # Root layout with auth guard
│   ├── components/
│   │   ├── dashboard/          # ExpensePieChart, MonthSummary, UpcomingBills, PredictionCard
│   │   ├── forms/              # ManualExpenseForm, ExtractionReview
│   │   └── shared/             # AlertBanner
│   ├── hooks/                  # useAuth, useExpenses, useExtraction, usePrediction, useDashboard
│   ├── lib/                    # API client, Firebase init
│   ├── store/                  # Zustand stores (auth, expense, income)
│   └── types/                  # Shared TypeScript types
│
├── docker-compose.yml          # Firebase Emulator Suite
├── firebase.json               # Firebase project config
├── firestore.indexes.json      # Composite indexes
└── storage.rules               # Firebase Storage security rules
```

## Getting Started

### Prerequisites
- Node.js >= 18
- Docker (for local Firebase emulators)
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup
```bash
cd functions
npm install
cp .env.example .env    # Edit with your secrets
npm run build           # Compile TypeScript
npm run serve           # Start the API server
```

### Frontend Setup
```bash
cd billbuddy
npm install
cp .env.example .env    # Edit with your config
npx expo start          # Start the Expo dev server
```

### Local Development with Docker
```bash
docker-compose up       # Starts Firebase Emulator Suite
```
Emulator UI available at `http://localhost:4000`.

## Running Tests

### Backend
```bash
cd functions
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:property       # Property-based tests only
```

### Testing Approach
- Unit tests with Jest + Supertest for API routes
- Property-based tests with fast-check (26 correctness properties, 100 iterations each)
- Properties cover: auth security, data isolation, extraction mapping, prediction invariants, API envelope conformance, dashboard aggregation, and alert thresholds

## API Endpoints

All responses follow the `{ data, error }` envelope format.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | No | Create account |
| POST | `/auth/login` | No | Login |
| GET | `/expenses` | Yes | List expenses (filterable) |
| POST | `/expenses` | Yes | Create expense |
| PUT | `/expenses/:id` | Yes | Update expense |
| DELETE | `/expenses/:id` | Yes | Delete expense |
| GET | `/predictions` | Yes | Get expense predictions |
| GET | `/users/me` | Yes | Get user profile |
| PUT | `/users/income` | Yes | Set monthly income |

## Environment Variables

### Backend (`functions/.env`)
```
PORT=8080
FIREBASE_PROJECT_ID=billbuddy-dev
JWT_SECRET=change_this_to_something_secure
AI_SERVICE_API_KEY=your_ai_key
EXCHANGE_RATE_API_KEY=your_exchange_key
WEATHER_API_KEY=your_weather_key
```

### Frontend (`billbuddy/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:8080/
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=billbuddy-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=billbuddy-dev
```
