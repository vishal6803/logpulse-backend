import pool from "../../config/db";
import { getAIAnalyzer } from "./ai.provider";
import {
  AIAnalysisResponse,
  AIAnalysisResult,
  ErrorGroupRecord,
  EventSampleRecord,
} from "./ai.types";

const CACHE_TTL_HOURS = 24;

/**
 * Checks if an analysis is fresh within the defined TTL.
 */
const isAnalysisFresh = (analyzedAt?: Date | null): boolean => {
  if (!analyzedAt) return false;
  const ageMs = Date.now() - new Date(analyzedAt).getTime();
  const maxAgeMs = CACHE_TTL_HOURS * 60 * 60 * 1000;
  return ageMs < maxAgeMs;
};

/**
 * Fetches representative event samples for an error group (compacted context).
 * Grabs 1 earliest event and up to 2 latest events to capture evolution/origin.
 */
const fetchSampleEvents = async (
  groupId: string
): Promise<EventSampleRecord[]> => {
  const query = `
    (
      SELECT id, type, level, message, stack_trace, metadata, created_at
      FROM events
      WHERE error_group_id = $1
      ORDER BY created_at ASC
      LIMIT 1
    )
    UNION
    (
      SELECT id, type, level, message, stack_trace, metadata, created_at
      FROM events
      WHERE error_group_id = $1
      ORDER BY created_at DESC
      LIMIT 2
    )
    ORDER BY created_at ASC;
  `;

  const result = await pool.query(query, [groupId]);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    level: row.level,
    message: row.message,
    stack_trace: row.stack_trace,
    metadata: row.metadata,
    created_at: row.created_at,
  }));
};

/**
 * Pure functional AI Analysis orchestrator.
 * Handles cache hits, token-compacted context extraction, LLM invocation, and persistence.
 */
export const analyzeErrorGroupService = async (
  groupId: string,
  options?: { force?: boolean }
): Promise<AIAnalysisResponse> => {
  // 1. Fetch Error Group
  const groupQuery = `
    SELECT id, project_id, environment_id, fingerprint, message, 
           occurrence_count, first_seen, last_seen, status,
           ai_summary, ai_root_cause, ai_fix_suggestion, ai_confidence, ai_analyzed_at
    FROM error_groups
    WHERE id = $1;
  `;
  const groupRes = await pool.query(groupQuery, [groupId]);

  if (groupRes.rows.length === 0) {
    const error: any = new Error(`Error group with ID '${groupId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const group: ErrorGroupRecord = groupRes.rows[0];

  // 2. Cache Inspection (Return in < 5ms if fresh and not forced)
  const isFresh = isAnalysisFresh(group.ai_analyzed_at);
  if (group.ai_summary && isFresh && !options?.force) {
    return {
      summary: group.ai_summary,
      rootCause: group.ai_root_cause || "No detailed root cause recorded.",
      fixSuggestion: group.ai_fix_suggestion || "No fix suggestion recorded.",
      confidence: (group.ai_confidence as any) || "medium",
      cached: true,
      analyzedAt: group.ai_analyzed_at
        ? new Date(group.ai_analyzed_at).toISOString()
        : new Date().toISOString(),
      errorGroupId: group.id,
    };
  }

  // 3. Cache Miss: Extract Compacted Context (1-3 sample events)
  const sampleEvents = await fetchSampleEvents(groupId);

  // 4. Resolve Pluggable AI Provider and Execute
  const analyzer = getAIAnalyzer();
  const analysisResult: AIAnalysisResult = await analyzer({
    errorGroup: group,
    sampleEvents,
  });

  // 5. Update error_groups Table (Store AI Triage Output)
  const updateQuery = `
    UPDATE error_groups
    SET ai_summary = $1,
        ai_root_cause = $2,
        ai_fix_suggestion = $3,
        ai_confidence = $4,
        ai_analyzed_at = NOW()
    WHERE id = $5
    RETURNING ai_analyzed_at;
  `;

  const updateRes = await pool.query(updateQuery, [
    analysisResult.summary,
    analysisResult.rootCause,
    analysisResult.fixSuggestion,
    analysisResult.confidence,
    groupId,
  ]);

  const analyzedAt = updateRes.rows[0]?.ai_analyzed_at || new Date();

  return {
    ...analysisResult,
    cached: false,
    analyzedAt: new Date(analyzedAt).toISOString(),
    errorGroupId: group.id,
  };
};

/**
 * Returns existing analysis for an error group if available.
 */
export const getCachedAnalysisService = async (
  groupId: string
): Promise<AIAnalysisResponse | null> => {
  const query = `
    SELECT id, ai_summary, ai_root_cause, ai_fix_suggestion, ai_confidence, ai_analyzed_at
    FROM error_groups
    WHERE id = $1;
  `;
  const res = await pool.query(query, [groupId]);

  if (res.rows.length === 0) {
    const error: any = new Error(`Error group with ID '${groupId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const row = res.rows[0];
  if (!row.ai_summary) {
    return null;
  }

  return {
    summary: row.ai_summary,
    rootCause: row.ai_root_cause || "",
    fixSuggestion: row.ai_fix_suggestion || "",
    confidence: row.ai_confidence || "medium",
    cached: true,
    analyzedAt: row.ai_analyzed_at ? new Date(row.ai_analyzed_at).toISOString() : new Date().toISOString(),
    errorGroupId: row.id,
  };
};
