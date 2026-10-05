import { AIErrorContext, EventSampleRecord } from "./ai.types";

/**
 * Sanitizes and trims stack traces to avoid token bloat.
 * Removes internal node / bundler lines and caps at maxFrames.
 */
export const sanitizeStackTrace = (
  rawStack?: string | null,
  maxFrames: number = 12
): string => {
  if (!rawStack || typeof rawStack !== "string") {
    return "No stack trace provided.";
  }

  const lines = rawStack.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter out obvious internal node/bundler runtime noise if trace is long
    if (
      lines.length > maxFrames &&
      (trimmed.includes("node:internal") ||
        trimmed.includes("processTicksAndRejections") ||
        trimmed.includes("webpack/bootstrap"))
    ) {
      continue;
    }

    filteredLines.push(trimmed);
    if (filteredLines.length >= maxFrames) {
      filteredLines.push(`... [truncated ${lines.length - maxFrames} additional frames]`);
      break;
    }
  }

  return filteredLines.join("\n");
};

/**
 * Prunes large or sensitive fields from metadata to protect tokens and privacy.
 */
export const pruneMetadata = (metadata: any): any => {
  if (!metadata || typeof metadata !== "object") return metadata;

  const pruned: Record<string, any> = {};
  const sensitiveKeys = new Set([
    "authorization",
    "cookie",
    "password",
    "secret",
    "token",
    "credit_card",
  ]);

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      pruned[key] = "[REDACTED]";
      continue;
    }

    // Limit deeply nested or huge objects
    if (typeof value === "string" && value.length > 500) {
      pruned[key] = value.substring(0, 500) + "... [truncated]";
    } else if (Array.isArray(value) && value.length > 5) {
      pruned[key] = value.slice(0, 5).concat(["... [truncated]"]);
    } else {
      pruned[key] = value;
    }
  }

  return pruned;
};

/**
 * Principal system prompt enforcing structured JSON output.
 */
export const buildSystemPrompt = (): string => {
  return `You are the AI Root-Cause Diagnostic Engine for LogPulse, an enterprise-grade observability and error-tracking platform.
Your objective is to inspect aggregated error groups, fingerprint metadata, and recent event samples to provide an accurate, actionable diagnosis.

RULES:
1. Deliver your final output as valid, raw JSON with NO surrounding markdown backticks (no \`\`\`json).
2. The JSON MUST strictly match this schema:
{
  "summary": "1-2 sentence executive overview of what failed in simple plain English",
  "rootCause": "Deep technical explanation of the failure mechanism (exact condition, variable, or logic fault)",
  "suspectedFile": "Probable source file path or null if unknown",
  "fixSuggestion": "Clear explanation of how to fix this with a concrete Markdown code snippet",
  "confidence": "high" | "medium" | "low"
}
3. Be concise, pragmatic, and avoid generic filler. Give production-ready fix snippets.`;
};

/**
 * Builds user prompt containing the compacted context.
 */
export const buildUserPrompt = (context: AIErrorContext): string => {
  const { errorGroup, sampleEvents } = context;

  const sampleSections = sampleEvents
    .slice(0, 3)
    .map((sample: EventSampleRecord, idx: number) => {
      const sanitizedStack = sanitizeStackTrace(sample.stack_trace);
      const cleanMetadata = sample.metadata ? JSON.stringify(pruneMetadata(sample.metadata), null, 2) : "None";

      return `### Event Sample ${idx + 1}:
- **Event ID**: ${sample.id}
- **Timestamp**: ${new Date(sample.created_at).toISOString()}
- **Type**: ${sample.type || "Error"} | **Level**: ${sample.level || "error"}
- **Message**: ${sample.message}
- **Metadata**: 
\`\`\`json
${cleanMetadata}
\`\`\`
- **Stack Trace**:
\`\`\`text
${sanitizedStack}
\`\`\``;
    })
    .join("\n\n");

  return `## Error Group Overview:
- **Group ID**: ${errorGroup.id}
- **Fingerprint**: ${errorGroup.fingerprint}
- **Primary Message**: ${errorGroup.message}
- **Occurrence Count**: ${errorGroup.occurrence_count}
- **First Seen**: ${new Date(errorGroup.first_seen).toISOString()}
- **Last Seen**: ${new Date(errorGroup.last_seen).toISOString()}
- **Current Status**: ${errorGroup.status}

## Representative Event Samples (${sampleEvents.length} samples):
${sampleSections || "No raw event samples recorded for this group yet."}

Analyze this error group and provide the structured root cause analysis JSON.`;
};
