import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { ExtractionResult } from "../types/extraction";

export interface AIClient {
  extractFromImage(imageUrl: string): Promise<ExtractionResult>;
  extractFromBase64(base64: string, mimeType: string): Promise<ExtractionResult>;
  extractFromText(text: string, attachments?: string[]): Promise<ExtractionResult>;
  generateInsights(prompt: string): Promise<string>;
}

const EXTRACTION_PROMPT = `You are a Thai domestic expense parser. Analyze the provided content and extract:
- amount: the total amount in THB (number)
- category: one of electricity, water, insurance, loan, gas, food, transport, household, entertainment, health, education, manual
- dueDate: the due date or transaction date in YYYY-MM-DD format

Respond ONLY with valid JSON:
{"amount":{"value":0,"confidence":0.0},"category":{"value":"manual","confidence":0.0},"dueDate":{"value":"2025-01-01","confidence":0.0}}
confidence is 0.0 to 1.0. If unsure, use a default with low confidence.`;

/**
 * Auto-detects provider from key format and creates the appropriate client.
 * - Keys starting with "sk-" → OpenAI
 * - Keys starting with "AIza" → Google Gemini
 */
export function createAIClient(apiKey?: string): AIClient {
  const key = apiKey ?? process.env.AI_SERVICE_API_KEY;
  if (!key) throw new Error("AI_SERVICE_API_KEY is not configured");

  if (key.startsWith("sk-")) {
    return createOpenAIClient(key);
  }
  return createGeminiClient(key);
}

// ─── Gemini ─────────────────────────────────────────────────
function createGeminiClient(key: string): AIClient {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  return {
    async extractFromImage(imageUrl: string): Promise<ExtractionResult> {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = response.headers.get("content-type") || "image/jpeg";

      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        { inlineData: { data: base64, mimeType } },
      ]);
      return parseExtractionResponse(result.response.text());
    },

    async extractFromBase64(base64: string, mimeType: string): Promise<ExtractionResult> {
      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        { inlineData: { data: base64, mimeType } },
      ]);
      return parseExtractionResponse(result.response.text());
    },

    async extractFromText(text: string): Promise<ExtractionResult> {
      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        `Content:\n${text}`,
      ]);
      return parseExtractionResponse(result.response.text());
    },

    async generateInsights(prompt: string): Promise<string> {
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
  };
}

// ─── OpenAI ─────────────────────────────────────────────────
function createOpenAIClient(key: string): AIClient {
  const openai = new OpenAI({ apiKey: key });

  return {
    async extractFromImage(imageUrl: string): Promise<ExtractionResult> {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: "Extract expense data from this image." },
          ]},
        ],
        max_tokens: 300,
      });
      return parseExtractionResponse(resp.choices[0]?.message?.content ?? "");
    },

    async extractFromBase64(base64: string, mimeType: string): Promise<ExtractionResult> {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: "Extract expense data from this image." },
          ]},
        ],
        max_tokens: 300,
      });
      return parseExtractionResponse(resp.choices[0]?.message?.content ?? "");
    },

    async extractFromText(text: string): Promise<ExtractionResult> {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Content:\n${text}` },
        ],
        max_tokens: 300,
      });
      return parseExtractionResponse(resp.choices[0]?.message?.content ?? "");
    },

    async generateInsights(prompt: string): Promise<string> {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "คุณเป็นที่ปรึกษาการเงินส่วนบุคคลสำหรับคนไทย ตอบเป็นภาษาไทย" },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      });
      return resp.choices[0]?.message?.content ?? "";
    },
  };
}

// ─── Shared parser ──────────────────────────────────────────
function parseExtractionResponse(text: string): ExtractionResult {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  try {
    const p = JSON.parse(cleaned);
    return {
      amount: { value: Number(p.amount?.value) || 0, confidence: Number(p.amount?.confidence) || 0.5 },
      category: { value: p.category?.value || "manual", confidence: Number(p.category?.confidence) || 0.5 },
      dueDate: { value: p.dueDate?.value || new Date().toISOString().slice(0, 10), confidence: Number(p.dueDate?.confidence) || 0.5 },
    };
  } catch {
    return {
      amount: { value: 0, confidence: 0 },
      category: { value: "manual", confidence: 0 },
      dueDate: { value: new Date().toISOString().slice(0, 10), confidence: 0 },
    };
  }
}
