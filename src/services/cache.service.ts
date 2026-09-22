import redis from "../config/redis";
import pool from "../config/db";

export interface CachedProject {
  id: string;
}

// Ultra-fast in-memory L1 cache with TTL
const localApiKeyCache = new Map<
  string,
  { project: CachedProject; expiresAt: number }
>();
const LOCAL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REDIS_TTL_SEC = 10 * 60; // 10 minutes

/**
 * Resolves a project by API key with L1 in-memory and L2 Redis caching.
 * Hits PostgreSQL ONLY on a complete cache miss (cold start).
 */
export const getProjectByApiKey = async (
  apiKey: string,
): Promise<CachedProject | null> => {
  const now = Date.now();

  // 1. L1: In-Memory Cache (0 network round-trips)
  const localEntry = localApiKeyCache.get(apiKey);
  if (localEntry && localEntry.expiresAt > now) {
    return localEntry.project;
  }

  // 2. L2: Redis Cache (<1ms)
  const redisKey = `cache:apikey:${apiKey}`;
  try {
    const cached = await redis.get(redisKey);
    if (cached) {
      const project: CachedProject = JSON.parse(cached);
      localApiKeyCache.set(apiKey, {
        project,
        expiresAt: now + LOCAL_TTL_MS,
      });
      return project;
    }
  } catch (err: any) {
    console.warn("[CacheService] Redis cache lookup failed:", err.message);
  }

  // 3. L3: Cold-start fallback to PostgreSQL
  const result = await pool.query(
    "SELECT id FROM projects WHERE api_key = $1",
    [apiKey],
  );

  const project = result.rows[0];
  if (!project) {
    return null;
  }

  const projectData: CachedProject = { id: project.id };

  // Update L1 and L2 caches
  localApiKeyCache.set(apiKey, {
    project: projectData,
    expiresAt: now + LOCAL_TTL_MS,
  });

  try {
    await redis.set(
      redisKey,
      JSON.stringify(projectData),
      "EX",
      REDIS_TTL_SEC,
    );
  } catch (err: any) {
    console.warn("[CacheService] Redis cache write failed:", err.message);
  }

  return projectData;
};

/**
 * Invalidate cache on API key regeneration or project deletion.
 */
export const invalidateApiKey = async (apiKey: string): Promise<void> => {
  localApiKeyCache.delete(apiKey);
  try {
    await redis.del(`cache:apikey:${apiKey}`);
  } catch (err: any) {
    console.warn("[CacheService] Redis key deletion failed:", err.message);
  }
};

// Optional helper object for convenience
export const CacheService = {
  getProjectByApiKey,
  invalidateApiKey,
};
