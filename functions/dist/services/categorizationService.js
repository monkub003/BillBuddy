"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategorizationService = createCategorizationService;
/**
 * Keyword map used for heuristic categorization.
 * Each default category has a list of keywords that hint at it.
 */
const CATEGORY_KEYWORDS = {
    electricity: [
        "electricity",
        "electric",
        "ค่าไฟ",
        "ไฟฟ้า",
        "pea",
        "mea",
        "power",
        "กฟน",
        "กฟภ",
    ],
    water: [
        "water",
        "ค่าน้ำ",
        "น้ำประปา",
        "ประปา",
        "mwa",
        "pwa",
    ],
    insurance: [
        "insurance",
        "ประกัน",
        "ประกันภัย",
        "ประกันชีวิต",
        "premium",
        "policy",
    ],
    loan: [
        "loan",
        "สินเชื่อ",
        "ผ่อน",
        "installment",
        "mortgage",
        "เงินกู้",
        "ผ่อนชำระ",
    ],
    gas: [
        "gas",
        "fuel",
        "petrol",
        "diesel",
        "น้ำมัน",
        "ปั๊ม",
        "benzine",
        "gasoline",
        "ptt",
        "shell",
        "esso",
    ],
    food: [
        "food",
        "อาหาร",
        "ข้าว",
        "restaurant",
        "ร้านอาหาร",
        "grab food",
        "foodpanda",
        "lineman",
    ],
    transport: [
        "transport",
        "การเดินทาง",
        "bts",
        "mrt",
        "taxi",
        "grab",
        "bolt",
        "bus",
        "รถไฟ",
        "เดินทาง",
    ],
    household: [
        "household",
        "ของใช้",
        "ในบ้าน",
        "big c",
        "lotus",
        "tesco",
        "makro",
        "ซุปเปอร์",
    ],
    entertainment: [
        "entertainment",
        "บันเทิง",
        "movie",
        "netflix",
        "spotify",
        "youtube",
        "หนัง",
        "เกม",
        "game",
    ],
    health: [
        "health",
        "สุขภาพ",
        "hospital",
        "โรงพยาบาล",
        "ยา",
        "medicine",
        "clinic",
        "คลินิก",
        "วิตามิน",
    ],
    education: [
        "education",
        "การศึกษา",
        "school",
        "tuition",
        "course",
        "เรียน",
        "ค่าเทอม",
        "หนังสือ",
    ],
    manual: [],
};
const CONFIDENCE_THRESHOLD = 0.7;
/**
 * Score a single category against the expense input using keyword matching.
 * Returns a confidence value between 0.0 and 1.0.
 */
function scoreCategory(category, input, customKeywords) {
    // "manual" category is the fallback — it only gets a base score
    const keywords = customKeywords[category] ?? CATEGORY_KEYWORDS[category] ?? [];
    if (keywords.length === 0) {
        return 0.05; // minimal base score for categories with no keywords
    }
    // If the input already has this category set explicitly, boost confidence
    if (input.category === category) {
        return 0.95;
    }
    // Build a searchable text from available input fields
    const searchText = [
        input.category,
        input.rawSourceRef ?? "",
    ]
        .join(" ")
        .toLowerCase();
    let matchCount = 0;
    for (const kw of keywords) {
        if (searchText.includes(kw.toLowerCase())) {
            matchCount++;
        }
    }
    if (matchCount === 0)
        return 0.0;
    // Scale confidence based on number of keyword matches relative to total keywords
    const ratio = matchCount / keywords.length;
    // Clamp between 0.3 (at least one match) and 0.9 (many matches)
    return Math.min(0.3 + ratio * 0.6, 0.9);
}
function createCategorizationService(deps) {
    const customKeywords = deps?.customKeywords ?? {};
    const correctionsStore = deps?.correctionsStore ?? null;
    /**
     * All categories to consider: default + any custom ones from customKeywords.
     */
    function getAllCategories() {
        const defaults = [
            "electricity",
            "water",
            "insurance",
            "loan",
            "gas",
            "manual",
        ];
        const customCats = Object.keys(customKeywords).filter((k) => !defaults.includes(k));
        return [...defaults, ...customCats];
    }
    async function categorize(expense) {
        const categories = getAllCategories();
        // Score every category
        const scored = categories.map((cat) => ({
            category: cat,
            confidence: scoreCategory(cat, expense, customKeywords),
        }));
        // Sort descending by confidence
        scored.sort((a, b) => b.confidence - a.confidence);
        const best = scored[0];
        const alternatives = scored
            .slice(1)
            .filter((s) => s.confidence > 0);
        return {
            category: best.category,
            confidence: best.confidence,
            needsUserConfirmation: best.confidence < CONFIDENCE_THRESHOLD,
            alternatives,
        };
    }
    async function recordUserCorrection(expenseId, correctCategory) {
        if (!correctionsStore) {
            throw new Error("Corrections store is not configured");
        }
        const correction = {
            expenseId,
            correctCategory,
            correctedAt: new Date().toISOString(),
        };
        await correctionsStore.set(expenseId, correction);
    }
    async function getCorrection(expenseId) {
        if (!correctionsStore) {
            throw new Error("Corrections store is not configured");
        }
        return correctionsStore.get(expenseId);
    }
    return { categorize, recordUserCorrection, getCorrection };
}
//# sourceMappingURL=categorizationService.js.map