import redis from "../config/redis";
import { EVENTS_STREAM_KEY } from "../services/streamProducer.service";
import {
  CONSUMER_GROUP,
  persistBatch,
  StreamMessage,
} from "./batchPersistence.service";

const MIN_IDLE_TIME_MS = 60000; // 60s idle threshold to consider a worker crashed
const CLAIM_BATCH_SIZE = 50;

/**
 * Scans Pending Entries List (PEL) via XPENDING and claims abandoned messages via XCLAIM.
 * Runs on worker startup and periodically in the background.
 */
export const recoverPendingMessages = async (
  consumerName: string,
): Promise<number> => {
  try {
    // 1. Inspect unacknowledged messages in PEL
    // XPENDING <stream> <group> <start> <end> <count>
    const pendingSummary: any = await redis.xpending(
      EVENTS_STREAM_KEY,
      CONSUMER_GROUP,
      "-",
      "+",
      CLAIM_BATCH_SIZE,
    );

    if (
      !pendingSummary ||
      !Array.isArray(pendingSummary) ||
      pendingSummary.length === 0
    ) {
      return 0;
    }

    // Filter messages idle for longer than MIN_IDLE_TIME_MS
    const expiredMessageIds: string[] = [];
    for (const entry of pendingSummary) {
      // entry: [messageId, consumerName, idleTimeMs, deliveryCount]
      const [messageId, , idleTime] = entry;
      if (Number(idleTime) >= MIN_IDLE_TIME_MS) {
        expiredMessageIds.push(messageId);
      }
    }

    if (expiredMessageIds.length === 0) {
      return 0;
    }

    console.log(
      `[StreamRecovery] Found ${expiredMessageIds.length} stuck messages. Claiming for consumer ${consumerName}...`,
    );

    // 2. Claim expired messages
    // XCLAIM <stream> <group> <consumer> <min-idle-time> <ID-1> <ID-2> ...
    const claimedEntries: any = await redis.xclaim(
      EVENTS_STREAM_KEY,
      CONSUMER_GROUP,
      consumerName,
      MIN_IDLE_TIME_MS,
      ...expiredMessageIds,
    );

    if (
      !claimedEntries ||
      !Array.isArray(claimedEntries) ||
      claimedEntries.length === 0
    ) {
      return 0;
    }

    const streamMessages: StreamMessage[] = [];
    for (const entry of claimedEntries) {
      const [messageId, fields] = entry;
      // fields: ["payload", "{...}"]
      let rawPayload = "";
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === "payload") {
          rawPayload = fields[i + 1];
          break;
        }
      }

      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload);
          streamMessages.push({ messageId, payload: parsed });
        } catch (err) {
          console.error(
            `[StreamRecovery] Failed to parse recovered message ${messageId}:`,
            err,
          );
        }
      }
    }

    if (streamMessages.length > 0) {
      await persistBatch(streamMessages);
      console.log(
        `[StreamRecovery] Successfully recovered and persisted ${streamMessages.length} stuck messages.`,
      );
    }

    return streamMessages.length;
  } catch (error) {
    console.error("[StreamRecovery] Error during recovery cycle:", error);
    return 0;
  }
};

// Helper object for backward compatibility
export const StreamRecoveryService = {
  recoverPendingMessages,
};
