import { AIAnalyzerFn } from "./ai.types";
import { analyzeWithGemini } from "./providers/gemini.provider";
import { analyzeWithOpenAI } from "./providers/openai.provider";

/**
 * Functional provider resolver: inspects AI_PROVIDER environment variable
 * Defaults to Gemini (@google/genai)
 */
export const getAIAnalyzer = (): AIAnalyzerFn => {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase().trim();

  if (provider === "openai") {
    return analyzeWithOpenAI;
  }

  return analyzeWithGemini;
};
