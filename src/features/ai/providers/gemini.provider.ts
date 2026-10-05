import { GoogleGenAI } from "@google/genai";
import { AIAnalysisResult, AIAnalysisResultSchema, AIErrorContext } from "../ai.types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt.builder";


export const analyzeWithGemini = async (
  context: AIErrorContext
): Promise<AIAnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not defined in environment variables. Please set it in server/.env"
    );
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  const response = await ai.models.generateContent({
    model: modelName,
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error("Gemini returned an empty response");
  }

  // Clean any markdown backticks if model wrapped JSON
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  // Strict runtime validation with Zod
  return AIAnalysisResultSchema.parse(parsed);
};
