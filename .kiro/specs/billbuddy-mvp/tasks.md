# Implementation Plan: BillSense - AI Household Expense Predictor

## Overview

สร้าง BillSense backend (TypeScript/Node.js) และ mobile app (React Native) แบบ incremental โดยเริ่มจาก data models, core modules (DataExtractor, Categorizer, BillParser), ไปจนถึง TrendAnalyzer, FinancialPlanner, NotificationService และ Dashboard พร้อม property-based tests ด้วย fast-check

## Tasks

- [x] 1. ตั้งค่าโครงสร้างโปรเจกต์และ Core Data Models
  - [x] 1.1 สร้างโครงสร้างโปรเจกต์ TypeScript/Node.js backend พร้อม tsconfig, package.json, Jest + fast-check
    - สร้าง directory structure: `src/models`, `src/services`, `src/utils`, `src/tests`
    - ติดตั้ง dependencies: express, pg, jest, fast-check, supertest
    - _Requirements: 8.1_

  - [x] 1.2 สร้าง Core Data Model interfaces และ types ทั้งหมด
    - สร้าง `src/models/types.ts` ที่มี User, Income, ExpenseRecord, Category, Budget, Notification, WeatherFactor, LineItem
    - สร้าง `src/models/constants.ts` สำหรับ DEFAULT_CATEGORIES
    - สร้าง validation functions สำหรับแต่ละ model (amount > 0, valid dates, valid currency)
    - _Requirements: 1.1, 1.2, 2.1, 2.4, 6.1, 9.1_

  - [x] 1.3 เขียน property test สำหรับ Income Storage Round-Trip
    - **Property 21: Income store → retrieve round-trip**
    - **Validates: Requirements 6.1**

- [x] 2. Implement BillParser Module (Round-Trip)
  - [x] 2.1 Implement BillParser: serialize/deserialize (JSON round-trip)
    - สร้าง `src/services/bill-parser.ts` ที่ implement `serialize()` และ `deserialize()` สำหรับ ExpenseRecord
    - ใช้ JSON เป็น canonical format ตาม design decision
    - _Requirements: 9.1, 9.3_

  - [x] 2.2 เขียน property test สำหรับ Serialization Round-Trip
    - **Property 1: Expense Record Round-Trip (Serialization) — serialize → deserialize = identity**
    - **Validates: Requirements 9.1, 9.3**

  - [x] 2.3 Implement BillParser: format/parse (Display round-trip)
    - Implement `format()` ที่แปลง ExpenseRecord เป็น pretty-print string
    - Implement `parse()` ที่แปลง display string กลับเป็น ExpenseRecord
    - _Requirements: 9.2, 9.3_

  - [x] 2.4 เขียน property test สำหรับ Display Format Round-Trip
    - **Property 2: Expense Record Format Round-Trip (Display) — format → parse = identity**
    - **Validates: Requirements 9.2, 9.3**

- [x] 3. Checkpoint - ตรวจสอบ BillParser round-trip
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement DataExtractor Module
  - [x] 4.1 Implement extractFromEmail() สำหรับสกัดข้อมูลจากอีเมลบิล
    - สร้าง `src/services/data-extractor.ts`
    - Implement NLP-based extraction สำหรับ amount, dueDate, provider, billDate
    - Return ExtractionResult พร้อม confidence score
    - จัดการ error case: อีเมลไม่มีข้อมูลบิล (return success: false)
    - _Requirements: 1.1, 1.5_

  - [x] 4.2 เขียน property test สำหรับ Email Extraction Completeness
    - **Property 3: Email Extraction Completeness — valid bill email ต้องมี amount > 0, provider non-empty, billDate valid**
    - **Validates: Requirements 1.1**

  - [x] 4.3 Implement extractFromImage() และ validateImageQuality()
    - Implement OCR-based extraction สำหรับรูปถ่ายสลิป
    - Implement validateImageQuality() ตรวจสอบคุณภาพรูป (blurry, too_dark, rotated)
    - Return คำแนะนำการถ่ายรูปใหม่เมื่อคุณภาพต่ำ
    - _Requirements: 1.2, 1.4_

  - [x] 4.4 เขียน property test สำหรับ Line Items Consistency
    - **Property 4: Image Extraction Line Items Consistency — ผลรวม lineItems.amount = amount รวม**
    - **Validates: Requirements 1.2**

  - [x] 4.5 Implement extraction confirmation flow (pending_confirmation state)
    - สร้าง state management สำหรับ extraction result ที่ต้องรอ user confirmation ก่อนบันทึก
    - ไม่มี auto-save โดยไม่ผ่านการยืนยัน
    - _Requirements: 1.3_

  - [x] 4.6 เขียน property test สำหรับ Extraction Requires User Confirmation
    - **Property 5: Extraction Requires User Confirmation — successful extraction ต้องอยู่ใน state pending_confirmation**
    - **Validates: Requirements 1.3**

- [x] 5. Implement ExpenseCategorizer Module
  - [x] 5.1 Implement categorize() สำหรับจัดหมวดหมู่อัตโนมัติ
    - สร้าง `src/services/expense-categorizer.ts`
    - Implement auto-categorization ด้วย keyword matching + ML confidence
    - Return CategorizationResult พร้อม confidence, needsUserConfirmation flag
    - รองรับ default categories และ custom categories
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 5.2 เขียน property test สำหรับ Auto-Categorization Assignment
    - **Property 6: Auto-Categorization Assignment — ทุก ExpenseRecord ต้องได้ valid categoryId และ confidence ∈ [0.0, 1.0]**
    - **Validates: Requirements 2.1, 2.4**

  - [x] 5.3 เขียน property test สำหรับ Low Confidence Triggers User Confirmation
    - **Property 7: Low Confidence Triggers User Confirmation — confidence < 0.7 → needsUserConfirmation = true**
    - **Validates: Requirements 2.2**

  - [x] 5.4 Implement recordUserCorrection() และ createCustomCategory()
    - Implement feedback loop: บันทึก user correction เข้า training data
    - Implement createCustomCategory() สำหรับหมวดหมู่ที่ผู้ใช้สร้างเอง
    - _Requirements: 2.3, 2.4_

  - [x] 5.5 เขียน property test สำหรับ User Correction Persistence
    - **Property 8: User Correction Persistence — correction ที่บันทึกแล้วต้อง query กลับได้ตรงกัน**
    - **Validates: Requirements 2.3**

- [x] 6. Checkpoint - ตรวจสอบ DataExtractor และ Categorizer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Dashboard Data Layer
  - [x] 7.1 Implement Dashboard data aggregation functions
    - สร้าง `src/services/dashboard-service.ts`
    - Implement monthly expense summary แยกตามหมวดหมู่ (สำหรับ pie chart)
    - Implement monthly comparison data ย้อนหลัง 12 เดือน (สำหรับ bar chart)
    - Implement category detail query
    - Implement expense-to-income ratio display
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.2 เขียน property test สำหรับ Dashboard Category Sum
    - **Property 9: Dashboard Category Sum Equals Total — ผลรวมค่าใช้จ่ายแยกหมวดหมู่ = ยอดรวมเดือน**
    - **Validates: Requirements 3.1**

  - [x] 7.3 เขียน property test สำหรับ Category Filter
    - **Property 10: Category Filter Returns Correct Expenses — filter ด้วย categoryId ต้อง return เฉพาะ records ที่ตรงกัน**
    - **Validates: Requirements 3.3**

  - [x] 7.4 เขียน property test สำหรับ Historical Data Completeness
    - **Property 11: Historical Data Completeness — query N เดือนต้อง return ครบ N data points**
    - **Validates: Requirements 3.2, 6.4**

- [x] 8. Implement TrendAnalyzer Module
  - [x] 8.1 Implement analyzeTrend() และ detectRecurringExpenses()
    - สร้าง `src/services/trend-analyzer.ts`
    - Implement trend analysis รายหมวดหมู่ (ต้องมีข้อมูลอย่างน้อย 3 เดือน)
    - Implement recurring expense detection (monthly/quarterly/yearly patterns)
    - Return TrendResult พร้อม direction, changePercentage, confidence
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 8.2 เขียน property test สำหรับ Minimum Data Requirement
    - **Property 12: Trend Analysis Minimum Data Requirement — ข้อมูล < 3 เดือน ต้อง flag insufficient data**
    - **Validates: Requirements 4.1**

  - [x] 8.3 เขียน property test สำหรับ Recurring Expense Detection
    - **Property 14: Recurring Expense Detection — pattern ซ้ำในช่วงเวลาคงที่ต้องถูกตรวจจับ**
    - **Validates: Requirements 4.3**

  - [x] 8.4 เขียน property test สำหรับ Confidence Range Invariant
    - **Property 16: Prediction Confidence Range Invariant — confidence ∈ [0.0, 1.0] เสมอ**
    - **Validates: Requirements 4.5**

  - [x] 8.5 Implement predictNextMonth() พร้อม Weather Adjustment
    - Implement getWeatherAdjustment() สำหรับดึงข้อมูลสภาพอากาศ
    - Implement prediction ที่ปรับตาม WeatherFactor สำหรับค่าไฟฟ้า
    - Implement spike detection (>20% เทียบกับค่าเฉลี่ย 3 เดือน)
    - _Requirements: 4.2, 4.4_

  - [x] 8.6 เขียน property test สำหรับ Weather-Adjusted Prediction
    - **Property 13: Weather-Adjusted Electricity Prediction — temperature deviation ที่มีนัยสำคัญต้องเปลี่ยน prediction**
    - **Validates: Requirements 4.2**

  - [x] 8.7 เขียน property test สำหรับ Trend Spike Warning
    - **Property 15: Trend Spike Warning Trigger — ค่าใช้จ่ายเกินค่าเฉลี่ย >20% ต้อง generate warning**
    - **Validates: Requirements 4.4**

- [x] 9. Checkpoint - ตรวจสอบ TrendAnalyzer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement NotificationService Module
  - [x] 10.1 Implement notification triggers ทุกประเภท
    - สร้าง `src/services/notification-service.ts`
    - Implement sendBillDueReminder(): แจ้งเตือน 7 วันก่อน due date (monthly/quarterly), 30 วันก่อน (yearly)
    - Implement sendExpenseWarning(): แจ้งเตือนเมื่อ predicted expense สูงกว่าค่าเฉลี่ย >15%
    - Implement sendBudgetAlert(): แจ้งเตือนเมื่อ spending >= 80% ของ budget
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 10.2 เขียน property test สำหรับ Notification Timing
    - **Property 17: Notification Timing Based on Due Date — 7 วันสำหรับ monthly/quarterly, 30 วันสำหรับ yearly**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 10.3 เขียน property test สำหรับ Predicted Expense Spike Notification
    - **Property 18: Predicted Expense Spike Notification — totalPredicted สูงกว่าค่าเฉลี่ย >15% ต้อง generate notification**
    - **Validates: Requirements 5.2**

  - [x] 10.4 เขียน property test สำหรับ Budget Threshold Alert
    - **Property 19: Budget Threshold Alert — spending >= 80% ของ budget ต้อง trigger alert**
    - **Validates: Requirements 5.4**

  - [x] 10.5 Implement notification preferences management
    - Implement getNotificationPreferences() และ updateNotificationPreferences()
    - รองรับ channels: push, email
    - รองรับการตั้งค่า billReminder, budgetAlert, trendWarning, yearlyExpenseReminder
    - _Requirements: 5.5_

- [x] 11. Implement FinancialPlanner Module
  - [x] 11.1 Implement calculateExpenseRatio() และ expense-to-income analysis
    - สร้าง `src/services/financial-planner.ts`
    - Implement ratio = totalExpense / totalIncome
    - Flag isHealthy = false เมื่อ ratio > 0.7 พร้อม generate cost reduction suggestions
    - Handle กรณีไม่มีข้อมูลรายได้ (แสดงเฉพาะค่าใช้จ่าย)
    - Implement comparison ย้อนหลัง 6 เดือน
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.2 เขียน property test สำหรับ Expense Ratio Calculation
    - **Property 20: Expense Ratio Calculation and Warning — ratio = totalExpense/totalIncome, ratio > 0.7 → isHealthy = false**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 11.3 Implement generateBudgetPlan() และ forecastExpenses()
    - Implement budget plan สร้างจาก historical data + TrendAnalyzer predictions
    - Implement forecast 3 เดือนข้างหน้า แยกรายหมวดหมู่
    - Implement suggestCostReduction() แนะนำหมวดหมู่ที่ลดค่าใช้จ่ายได้
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.4 เขียน property test สำหรับ Budget Plan Category Coverage
    - **Property 22: Budget Plan Category Coverage — budget ต้องครอบคลุมทุก active category, sum ≤ totalBudget**
    - **Validates: Requirements 7.1**

  - [x] 11.5 เขียน property test สำหรับ Forecast Completeness
    - **Property 23: Forecast Completeness — forecast N เดือนต้อง return ครบ N เดือน ทุก active category**
    - **Validates: Requirements 7.2**

  - [x] 11.6 เขียน property test สำหรับ Cost Reduction Suggestions
    - **Property 24: Cost Reduction Suggestions Validity — suggestedBudget < currentAverage, potentialSaving > 0**
    - **Validates: Requirements 7.3**

  - [x] 11.7 Implement calculateBudgetFromSavingsGoal() และ auto-update
    - Implement คำนวณ max monthly budget = income - savingsGoal
    - Implement auto-update budget plan เมื่อมี ExpenseRecord ใหม่
    - _Requirements: 7.4, 7.5_

  - [x] 11.8 เขียน property test สำหรับ Savings Goal Budget
    - **Property 25: Savings Goal Budget Calculation — totalBudget ≤ income - savingsGoal**
    - **Validates: Requirements 7.4**

  - [x] 11.9 เขียน property test สำหรับ Budget Auto-Update
    - **Property 26: Budget Plan Auto-Update on New Expense — lastUpdated ต้องเปลี่ยนเมื่อมี expense ใหม่**
    - **Validates: Requirements 7.5**

- [x] 12. Checkpoint - ตรวจสอบ NotificationService และ FinancialPlanner
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Authentication และ Cloud Security
  - [x] 13.1 Implement Auth Service พร้อม Biometric และ Multi-Device Verification
    - สร้าง `src/services/auth-service.ts`
    - Implement biometric authentication (ลายนิ้วมือ/Face ID) integration
    - Implement new device verification: ส่งรหัสยืนยันไปยังอีเมล/เบอร์โทร
    - Implement data encryption at rest และ in transit (AES-256, TLS 1.3)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 13.2 Implement account deletion และ data backup
    - Implement account deletion: ลบข้อมูลทั้งหมดจากทุก table ภายใน 30 วัน
    - Implement automated daily backup (ทุก 24 ชั่วโมง)
    - _Requirements: 8.4, 8.5_

  - [x] 13.3 เขียน property test สำหรับ Account Deletion
    - **Property 27: Account Deletion Data Removal — หลัง deletion, query ด้วย userId ต้อง return empty ทุก table**
    - **Validates: Requirements 8.5**

- [x] 14. Wiring: เชื่อมต่อ API Gateway และ Event-Driven Pipeline
  - [x] 14.1 สร้าง API Gateway routes และเชื่อมต่อทุก service
    - สร้าง `src/api/routes.ts` สำหรับ REST API endpoints
    - เชื่อม DataExtractor → ExpenseCategorizer pipeline (event-driven)
    - เชื่อม TrendAnalyzer → NotificationService triggers
    - เชื่อม FinancialPlanner → Budget auto-update flow
    - เชื่อม Scheduler → TrendAnalyzer + NotificationService (cron jobs)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 4.4, 5.1, 5.2, 7.5_

  - [x] 14.2 สร้าง Database schema และ migration scripts
    - สร้าง PostgreSQL migration สำหรับ users, expenses, incomes, categories, budgets, notifications tables
    - สร้าง seed data สำหรับ DEFAULT_CATEGORIES
    - _Requirements: 8.1, 8.4_

- [x] 15. Final Checkpoint - ตรวจสอบระบบทั้งหมด
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks ที่มี `*` เป็น optional สามารถข้ามได้สำหรับ MVP
- ทุก task อ้างอิง requirements เฉพาะเพื่อ traceability
- Checkpoints ช่วยตรวจสอบความถูกต้องแบบ incremental
- Property tests ใช้ fast-check library สำหรับ TypeScript
- Unit tests ใช้ Jest framework
- ใช้ TypeScript เป็นภาษาหลักสำหรับทั้ง backend และ testing
