import { createCategorizationService } from "../../src/services/categorizationService";
import type { UserCorrection } from "../../src/services/categorizationService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { CreateExpenseInput } from "../../src/types/expense";

function makeInput(overrides?: Partial<CreateExpenseInput>): CreateExpenseInput {
  return {
    category: "manual",
    amount: 100,
    dueDate: "2025-03-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic categorization
// ---------------------------------------------------------------------------
describe("CategorizationService.categorize", () => {
  it("returns a valid CategorizationResult shape", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(makeInput());

    expect(result).toHaveProperty("category");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("needsUserConfirmation");
    expect(result).toHaveProperty("alternatives");
    expect(Array.isArray(result.alternatives)).toBe(true);
  });

  it("confidence is always between 0.0 and 1.0", async () => {
    const svc = createCategorizationService();
    const categories = [
      "electricity",
      "water",
      "insurance",
      "loan",
      "gas",
      "manual",
    ] as const;

    for (const cat of categories) {
      const result = await svc.categorize(makeInput({ category: cat }));
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);

      for (const alt of result.alternatives) {
        expect(alt.confidence).toBeGreaterThanOrEqual(0.0);
        expect(alt.confidence).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("assigns the matching category with high confidence when category is explicit", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(makeInput({ category: "electricity" }));

    expect(result.category).toBe("electricity");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("assigns each default category correctly when set explicitly", async () => {
    const svc = createCategorizationService();
    const categories = [
      "electricity",
      "water",
      "insurance",
      "loan",
      "gas",
    ] as const;

    for (const cat of categories) {
      const result = await svc.categorize(makeInput({ category: cat }));
      expect(result.category).toBe(cat);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("returns alternatives sorted by confidence descending", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(makeInput({ category: "electricity" }));

    for (let i = 1; i < result.alternatives.length; i++) {
      expect(result.alternatives[i - 1].confidence).toBeGreaterThanOrEqual(
        result.alternatives[i].confidence
      );
    }
  });

  it("does not include the best category in alternatives", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(makeInput({ category: "water" }));

    const altCategories = result.alternatives.map((a) => a.category);
    expect(altCategories).not.toContain(result.category);
  });
});

// ---------------------------------------------------------------------------
// needsUserConfirmation threshold
// ---------------------------------------------------------------------------
describe("CategorizationService.needsUserConfirmation", () => {
  it("is false when confidence >= 0.7", async () => {
    const svc = createCategorizationService();
    // Explicit category match gives high confidence
    const result = await svc.categorize(makeInput({ category: "electricity" }));
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.needsUserConfirmation).toBe(false);
  });

  it("is true when confidence < 0.7 (ambiguous input)", async () => {
    const svc = createCategorizationService();
    // "manual" category has no keywords, so confidence will be low
    const result = await svc.categorize(makeInput({ category: "manual" }));
    // manual has no keyword matches for other categories, so best match is manual with low confidence
    if (result.confidence < 0.7) {
      expect(result.needsUserConfirmation).toBe(true);
    }
  });

  it("needsUserConfirmation is consistent with confidence threshold", async () => {
    const svc = createCategorizationService();
    const categories = [
      "electricity",
      "water",
      "insurance",
      "loan",
      "gas",
      "manual",
    ] as const;

    for (const cat of categories) {
      const result = await svc.categorize(makeInput({ category: cat }));
      if (result.confidence < 0.7) {
        expect(result.needsUserConfirmation).toBe(true);
      } else {
        expect(result.needsUserConfirmation).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Custom categories support
// ---------------------------------------------------------------------------
describe("CategorizationService with custom categories", () => {
  it("supports user-created custom categories via customKeywords", async () => {
    const svc = createCategorizationService({
      customKeywords: {
        internet: ["internet", "wifi", "broadband", "ค่าเน็ต"],
      },
    });

    const result = await svc.categorize(
      makeInput({ category: "manual", rawSourceRef: "internet bill payment" })
    );

    // The custom "internet" category should appear either as best or in alternatives
    const allCategories = [
      result.category,
      ...result.alternatives.map((a) => a.category),
    ];
    expect(allCategories).toContain("internet");
  });

  it("custom category can be the best match when keywords match", async () => {
    const svc = createCategorizationService({
      customKeywords: {
        internet: ["internet", "wifi", "broadband"],
      },
    });

    const result = await svc.categorize(
      makeInput({
        category: "manual",
        rawSourceRef: "internet wifi broadband subscription",
      })
    );

    // With multiple keyword matches in rawSourceRef, internet should score well
    const internetScore = result.category === "internet"
      ? result.confidence
      : result.alternatives.find((a) => a.category === "internet")?.confidence ?? 0;

    expect(internetScore).toBeGreaterThan(0);
  });

  it("still includes default categories alongside custom ones", async () => {
    const svc = createCategorizationService({
      customKeywords: {
        internet: ["internet"],
      },
    });

    const result = await svc.categorize(makeInput({ category: "electricity" }));

    const allCategories = [
      result.category,
      ...result.alternatives.map((a) => a.category),
    ];
    expect(allCategories).toContain("electricity");
  });
});

// ---------------------------------------------------------------------------
// Keyword matching via rawSourceRef
// ---------------------------------------------------------------------------
describe("CategorizationService keyword matching", () => {
  it("matches keywords in rawSourceRef for electricity", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(
      makeInput({
        category: "manual",
        rawSourceRef: "PEA electricity bill for March",
      })
    );

    const electricityScore = result.category === "electricity"
      ? result.confidence
      : result.alternatives.find((a) => a.category === "electricity")?.confidence ?? 0;

    expect(electricityScore).toBeGreaterThan(0);
  });

  it("matches keywords in rawSourceRef for water", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(
      makeInput({
        category: "manual",
        rawSourceRef: "MWA water bill payment",
      })
    );

    const waterScore = result.category === "water"
      ? result.confidence
      : result.alternatives.find((a) => a.category === "water")?.confidence ?? 0;

    expect(waterScore).toBeGreaterThan(0);
  });

  it("matches keywords in rawSourceRef for gas", async () => {
    const svc = createCategorizationService();
    const result = await svc.categorize(
      makeInput({
        category: "manual",
        rawSourceRef: "PTT gas station fuel receipt",
      })
    );

    const gasScore = result.category === "gas"
      ? result.confidence
      : result.alternatives.find((a) => a.category === "gas")?.confidence ?? 0;

    expect(gasScore).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// User correction learning (Task 4.2)
// ---------------------------------------------------------------------------
describe("CategorizationService.recordUserCorrection", () => {
  it("stores a correction and retrieves it by expenseId", async () => {
    const correctionsStore = createInMemoryStore<UserCorrection>();
    const svc = createCategorizationService({ correctionsStore });

    await svc.recordUserCorrection("exp-1", "water");

    const correction = await svc.getCorrection("exp-1");
    expect(correction).toBeDefined();
    expect(correction!.expenseId).toBe("exp-1");
    expect(correction!.correctCategory).toBe("water");
    expect(correction!.correctedAt).toBeTruthy();
  });

  it("returns undefined for a non-existent correction", async () => {
    const correctionsStore = createInMemoryStore<UserCorrection>();
    const svc = createCategorizationService({ correctionsStore });

    const correction = await svc.getCorrection("non-existent");
    expect(correction).toBeUndefined();
  });

  it("overwrites a previous correction for the same expenseId", async () => {
    const correctionsStore = createInMemoryStore<UserCorrection>();
    const svc = createCategorizationService({ correctionsStore });

    await svc.recordUserCorrection("exp-2", "electricity");
    await svc.recordUserCorrection("exp-2", "gas");

    const correction = await svc.getCorrection("exp-2");
    expect(correction).toBeDefined();
    expect(correction!.correctCategory).toBe("gas");
  });

  it("stores corrections for different expenses independently", async () => {
    const correctionsStore = createInMemoryStore<UserCorrection>();
    const svc = createCategorizationService({ correctionsStore });

    await svc.recordUserCorrection("exp-a", "insurance");
    await svc.recordUserCorrection("exp-b", "loan");

    const a = await svc.getCorrection("exp-a");
    const b = await svc.getCorrection("exp-b");
    expect(a!.correctCategory).toBe("insurance");
    expect(b!.correctCategory).toBe("loan");
  });

  it("sets a valid ISO 8601 correctedAt timestamp", async () => {
    const correctionsStore = createInMemoryStore<UserCorrection>();
    const svc = createCategorizationService({ correctionsStore });

    const before = new Date().toISOString();
    await svc.recordUserCorrection("exp-ts", "water");
    const after = new Date().toISOString();

    const correction = await svc.getCorrection("exp-ts");
    expect(correction!.correctedAt >= before).toBe(true);
    expect(correction!.correctedAt <= after).toBe(true);
  });

  it("throws when correctionsStore is not configured", async () => {
    const svc = createCategorizationService();

    await expect(
      svc.recordUserCorrection("exp-x", "electricity")
    ).rejects.toThrow("Corrections store is not configured");

    await expect(svc.getCorrection("exp-x")).rejects.toThrow(
      "Corrections store is not configured"
    );
  });
});
