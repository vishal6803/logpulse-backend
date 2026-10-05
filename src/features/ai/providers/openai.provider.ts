import OpenAI from "openai";
import { AIAnalysisResult, AIAnalysisResultSchema, AIErrorContext } from "../ai.types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt.builder";

/**
 * Pure functional OpenAI analyzer - 0 classes
 */
export const analyzeWithOpenAI = async (
  context: AIErrorContext
): Promise<AIAnalysisResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not defined in environment variables. Please set it in server/.env"
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const rawText = response.choices[0]?.message?.content;
  if (!rawText) {
    throw new Error("OpenAI returned an empty response");
  }

  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  // Strict runtime validation with Zod
  return AIAnalysisResultSchema.parse(parsed);
};
