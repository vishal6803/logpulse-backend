import { z } from "zod";

/**
 * Zod schema defining strict JSON output structure from AI providers.
 */
export const AIAnalysisResultSchema = z.object({
  summary: z
    .string()
    .describe("1-2 sentence high-level executive summary of the failure"),
  rootCause: z
    .string()
    .describe("Specific technical breakdown of why this error occurred"),
  suspectedFile: z
    .string()
    .optional()
    .describe("Probable source code file or component where the issue originates"),
  fixSuggestion: z
    .string()
    .describe("Concrete markdown explanation and actionable code snippet to fix the issue"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence rating of the AI diagnosis"),
});

export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;

export interface ErrorGroupRecord {
  id: string;
  project_id: string;
  environment_id: string;
  fingerprint: string;
  message: string;
  occurrence_count: number;
  first_seen: Date;
  last_seen: Date;
  status: string;
  ai_summary?: string | null;
  ai_root_cause?: string | null;
  ai_fix_suggestion?: string | null;
  ai_confidence?: "high" | "medium" | "low" | null;
  ai_analyzed_at?: Date | null;
}

export interface EventSampleRecord {
  id: string;
  type?: string;
  level?: string;
  message: string;
  stack_trace?: string | null;
  metadata?: Record<string, any> | null;
  created_at: Date;
}

export interface AIErrorContext {
  errorGroup: ErrorGroupRecord;
  sampleEvents: EventSampleRecord[];
}

/**
 * Functional provider signature - pure function, 0 classes
 */
export type AIAnalyzerFn = (context: AIErrorContext) => Promise<AIAnalysisResult>;

export interface AIAnalysisResponse extends AIAnalysisResult {
  cached: boolean;
  analyzedAt: string;
  errorGroupId: string;
}
