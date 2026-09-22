import crypto from "crypto";
import { produceEvent } from "../../services/streamProducer.service";

/**
 * High-Throughput Ingestion Service (Hot Path):
 * - Zero PostgreSQL database queries
 * - Pushes event to Redis Stream
 * - Resolves in < 5ms
 */
export const createIngestion = async (
  projectId: string,
  environmentName: string,
  type: string,
  level: string,
  message: string,
  stack_trace: string,
  metadata: any,
) => {
  const eventId = crypto.randomUUID();

  // Push directly to Redis Stream (worker will handle batch DB persistence)
  await produceEvent({
    eventId,
    projectId,
    environmentName,
    type,
    level,
    message,
    stack_trace,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
  });

  return {
    eventId,
    message: "Event queued successfully",
  };
};
