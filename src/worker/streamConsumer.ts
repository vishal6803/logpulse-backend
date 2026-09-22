import redis from "../config/redis";
import { EVENTS_STREAM_KEY } from "../services/streamProducer.service";
import {
  CONSUMER_GROUP,
  persistBatch,
  StreamMessage,
} from "./batchPersistence.service";

/**
 * Functional stream consumer factory.
 * Manages continuous polling loop from Redis Streams using consumer groups.
 */
export const createStreamConsumer = (
  consumerName = `worker-${process.pid}`,
  batchSize = 200,
  blockMs = 2000,
) => {
  let isRunning = false;

  /**
   * Initializes the Redis Stream consumer group if it does not exist.
   */
  const initConsumerGroup = async (): Promise<void> => {
    try {
      // MKSTREAM creates the stream if it does not exist yet
      await redis.xgroup(
        "CREATE",
        EVENTS_STREAM_KEY,
        CONSUMER_GROUP,
        "0",
        "MKSTREAM",
      );
      console.log(
        `[StreamConsumer] Created consumer group '${CONSUMER_GROUP}' on stream '${EVENTS_STREAM_KEY}'`,
      );
    } catch (err: any) {
      if (err.message && err.message.includes("BUSYGROUP")) {
        // Consumer group already exists - perfectly normal
        console.log(
          `[StreamConsumer] Consumer group '${CONSUMER_GROUP}' already exists.`,
        );
      } else {
        console.error(
          `[StreamConsumer] Failed to initialize consumer group:`,
          err.message,
        );
        throw err;
      }
    }
  };

  /**
   * Starts the continuous stream polling loop.
   */
  const start = async (): Promise<void> => {
    await initConsumerGroup();
    isRunning = true;
    console.log(
      `[StreamConsumer] Started consumer '${consumerName}', listening for events...`,
    );

    while (isRunning) {
      try {
        // Read new messages delivered to this consumer group: ">"
        const response: any = await redis.call(
          "XREADGROUP",
          "GROUP",
          CONSUMER_GROUP,
          consumerName,
          "BLOCK",
          blockMs,
          "COUNT",
          batchSize,
          "STREAMS",
          EVENTS_STREAM_KEY,
          ">",
        );

        if (!response || response.length === 0) {
          continue;
        }

        // Support both [streamKey, entries] and [[streamKey, entries]] RESP responses
        let rawEntries: any[] = [];
        if (typeof response[0] === "string" && Array.isArray(response[1])) {
          rawEntries = response[1];
        } else if (Array.isArray(response[0]) && Array.isArray(response[0][1])) {
          rawEntries = response[0][1];
        }

        if (!rawEntries || rawEntries.length === 0) {
          continue;
        }

        const batch: StreamMessage[] = [];

        for (const entry of rawEntries) {
          const messageId = entry[0];
          const fields = entry[1];
          let rawPayload = "";

          for (let i = 0; i < fields.length; i += 2) {
            if (fields[i] === "payload") {
              rawPayload = fields[i + 1];
              break;
            }
          }

          if (rawPayload) {
            try {
              const payload = JSON.parse(rawPayload);
              batch.push({ messageId, payload });
            } catch (parseErr) {
              console.error(
                `[StreamConsumer] Failed to parse message ${messageId}:`,
                parseErr,
              );
              // Acknowledge corrupt message so it doesn't block the stream
              await redis.xack(EVENTS_STREAM_KEY, CONSUMER_GROUP, messageId);
            }
          }
        }

        if (batch.length > 0) {
          const startTime = Date.now();
          const persistedCount = await persistBatch(batch);
          const duration = Date.now() - startTime;
          console.log(
            `[StreamConsumer] Persisted batch of ${persistedCount} events in ${duration}ms`,
          );
        }
      } catch (error: any) {
        if (!isRunning) break;
        console.error(
          "[StreamConsumer] Error in consumption loop:",
          error.message,
        );
        // Short pause on error before retrying to prevent busy loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  /**
   * Graceful stop.
   */
  const stop = (): void => {
    console.log(`[StreamConsumer] Stopping consumer '${consumerName}'...`);
    isRunning = false;
  };

  return {
    start,
    stop,
    initConsumerGroup,
  };
};
