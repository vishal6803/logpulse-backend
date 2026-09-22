import redis from "../config/redis";

export const EVENTS_STREAM_KEY = "logpulse:events:stream";
export const STREAM_MAX_LEN = "100000";

export interface IngestionEventPayload {
  eventId: string;
  projectId: string;
  environmentName: string;
  type: string;
  level: string;
  message: string;
  stack_trace: string;
  metadata?: any;
  timestamp?: string;
}

/**
 * Pushes a raw ingestion event to Redis Stream.
 * Capped to MAXLEN ~ 100000 to prevent unbounded memory growth.
 */
export const produceEvent = async (
  payload: IngestionEventPayload,
): Promise<string> => {
  const streamMessageId = await redis.xadd(
    EVENTS_STREAM_KEY,
    "MAXLEN",
    "~",
    STREAM_MAX_LEN,
    "*",
    "payload",
    JSON.stringify(payload),
  );

  if (!streamMessageId) {
    throw new Error("Failed to append event to Redis Stream");
  }

  return streamMessageId;
};

// Optional helper object for convenience
export const StreamProducerService = {
  produceEvent,
};
