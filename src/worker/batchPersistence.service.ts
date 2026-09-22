import crypto from "crypto";
import { PoolClient } from "pg";
import pool from "../config/db";
import redis from "../config/redis";
import { IngestionEventPayload, EVENTS_STREAM_KEY } from "../services/streamProducer.service";

export const CONSUMER_GROUP = "logpulse-workers";

export interface StreamMessage {
  messageId: string;
  payload: IngestionEventPayload;
}

interface ProcessedEvent extends IngestionEventPayload {
  fingerprint: string;
  environmentId: string;
}

interface GroupSummary {
  projectId: string;
  environmentId: string;
  fingerprint: string;
  message: string;
  count: number;
  lastSeen: Date;
}

// In-memory cache for projectId:environmentName -> environmentId
const environmentCache = new Map<string, string>();

/**
 * Resolves environment ID for a project and environment name.
 * Cached in memory to eliminate repeated DB queries during high throughput.
 */
export const resolveEnvironmentId = async (
  client: PoolClient,
  projectId: string,
  environmentName: string,
): Promise<string> => {
  const cacheKey = `${projectId}:${environmentName.toLowerCase()}`;
  const cachedId = environmentCache.get(cacheKey);
  if (cachedId) return cachedId;

  // Check DB
  const res = await client.query(
    "SELECT id FROM environments WHERE project_id = $1 AND LOWER(name) = LOWER($2)",
    [projectId, environmentName],
  );

  if (res.rows.length > 0) {
    const id = res.rows[0].id;
    environmentCache.set(cacheKey, id);
    return id;
  }

  // Auto-create environment if missing so logs are not lost
  const insertRes = await client.query(
    `INSERT INTO environments (id, project_id, name, settings)
     VALUES (gen_random_uuid(), $1, $2, $3)
     RETURNING id`,
    [
      projectId,
      environmentName,
      JSON.stringify({ retention_days: 30, alerts_enabled: true }),
    ],
  );

  const newId = insertRes.rows[0].id;
  environmentCache.set(cacheKey, newId);
  return newId;
};

/**
 * Generates a deterministic SHA256 fingerprint for error grouping.
 */
export const computeFingerprint = (
  type: string,
  message: string,
  stackTrace: string,
): string => {
  const raw = `${type}-${message}-${stackTrace}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
};

/**
 * Processes a batch of stream messages using the Two-Query Bulk Execution pattern.
 * Query 1: Bulk UPSERT error_groups using unnest()
 * Query 2: Bulk INSERT events using unnest()
 * Only calls XACK upon successful database COMMIT.
 */
export const persistBatch = async (
  messages: StreamMessage[],
): Promise<number> => {
  if (!messages || messages.length === 0) return 0;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Resolve environment IDs & compute fingerprints
    const processedEvents: ProcessedEvent[] = [];
    const groupsMap = new Map<string, GroupSummary>();

    for (const msg of messages) {
      const { payload } = msg;
      const environmentId = await resolveEnvironmentId(
        client,
        payload.projectId,
        payload.environmentName,
      );

      const fingerprint = computeFingerprint(
        payload.type,
        payload.message,
        payload.stack_trace,
      );

      const eventDate = payload.timestamp
        ? new Date(payload.timestamp)
        : new Date();

      processedEvents.push({
        ...payload,
        fingerprint,
        environmentId,
      });

      const existingGroup = groupsMap.get(fingerprint);
      if (!existingGroup) {
        groupsMap.set(fingerprint, {
          projectId: payload.projectId,
          environmentId,
          fingerprint,
          message: payload.message,
          count: 1,
          lastSeen: eventDate,
        });
      } else {
        existingGroup.count += 1;
        if (eventDate > existingGroup.lastSeen) {
          existingGroup.lastSeen = eventDate;
        }
      }
    }

    const groups = Array.from(groupsMap.values());

    // ========================================================
    // QUERY 1: Single bulk multi-row UPSERT on error_groups
    // ========================================================
    const q1ProjectIds: string[] = [];
    const q1EnvironmentIds: string[] = [];
    const q1Fingerprints: string[] = [];
    const q1Messages: string[] = [];
    const q1Counts: number[] = [];
    const q1LastSeens: string[] = [];

    for (const g of groups) {
      q1ProjectIds.push(g.projectId);
      q1EnvironmentIds.push(g.environmentId);
      q1Fingerprints.push(g.fingerprint);
      q1Messages.push(g.message);
      q1Counts.push(g.count);
      q1LastSeens.push(g.lastSeen.toISOString());
    }

    const upsertGroupsQuery = `
      INSERT INTO error_groups (project_id, environment_id, fingerprint, message, occurrence_count, last_seen)
      SELECT 
        p::uuid,
        env::uuid,
        fp::text,
        msg::text,
        cnt::int,
        ls::timestamptz
      FROM unnest(
        $1::uuid[],
        $2::uuid[],
        $3::text[],
        $4::text[],
        $5::int[],
        $6::timestamptz[]
      ) AS t(p, env, fp, msg, cnt, ls)
      ON CONFLICT (fingerprint) DO UPDATE SET
        occurrence_count = error_groups.occurrence_count + EXCLUDED.occurrence_count,
        last_seen = EXCLUDED.last_seen
      RETURNING id, fingerprint;
    `;

    const groupUpsertResult = await client.query(upsertGroupsQuery, [
      q1ProjectIds,
      q1EnvironmentIds,
      q1Fingerprints,
      q1Messages,
      q1Counts,
      q1LastSeens,
    ]);

    // Map returned error_group_id by fingerprint
    const fingerprintToGroupId = new Map<string, string>();
    for (const row of groupUpsertResult.rows) {
      fingerprintToGroupId.set(row.fingerprint, row.id);
    }

    // ========================================================
    // QUERY 2: Single bulk multi-row INSERT into events
    // ========================================================
    const q2ProjectIds: string[] = [];
    const q2EnvironmentIds: string[] = [];
    const q2GroupIds: string[] = [];
    const q2Types: string[] = [];
    const q2Levels: string[] = [];
    const q2Messages: string[] = [];
    const q2StackTraces: string[] = [];
    const q2Metadatas: string[] = [];

    for (const event of processedEvents) {
      const errorGroupId = fingerprintToGroupId.get(event.fingerprint);
      if (!errorGroupId) continue;

      q2ProjectIds.push(event.projectId);
      q2EnvironmentIds.push(event.environmentId);
      q2GroupIds.push(errorGroupId);
      q2Types.push(event.type);
      q2Levels.push(event.level);
      q2Messages.push(event.message);
      q2StackTraces.push(event.stack_trace || "");
      q2Metadatas.push(JSON.stringify(event.metadata || {}));
    }

    const insertEventsQuery = `
      INSERT INTO events (project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata)
      SELECT 
        p::uuid,
        env::uuid,
        eg::uuid,
        t::text,
        l::text,
        m::text,
        st::text,
        md::jsonb
      FROM unnest(
        $1::uuid[],
        $2::uuid[],
        $3::uuid[],
        $4::text[],
        $5::text[],
        $6::text[],
        $7::text[],
        $8::text[]
      ) AS t(p, env, eg, t, l, m, st, md);
    `;

    await client.query(insertEventsQuery, [
      q2ProjectIds,
      q2EnvironmentIds,
      q2GroupIds,
      q2Types,
      q2Levels,
      q2Messages,
      q2StackTraces,
      q2Metadatas,
    ]);

    // Commit transaction
    await client.query("COMMIT");

    // Acknowledge all processed messages in Redis Stream (XACK)
    const messageIds = messages.map((m) => m.messageId);
    if (messageIds.length > 0) {
      await redis.xack(EVENTS_STREAM_KEY, CONSUMER_GROUP, ...messageIds);
    }

    return processedEvents.length;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[BatchPersistence] Transaction failed, rolled back:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Helper object for backward compatibility
export const BatchPersistenceService = {
  resolveEnvironmentId,
  computeFingerprint,
  persistBatch,
};
