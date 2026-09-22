import dotenv from "dotenv";
dotenv.config();

import { createStreamConsumer } from "./streamConsumer";
import { recoverPendingMessages } from "./recovery.service";
import pool from "../config/db";
import redis from "../config/redis";

const consumerName = process.env.WORKER_NAME || `worker-${process.pid}`;
const consumer = createStreamConsumer(consumerName, 200, 2000);

let recoveryInterval: NodeJS.Timeout | null = null;

async function startWorker() {
  console.log("==========================================");
  console.log(` Starting LogPulse Stream Worker [${consumerName}]`);
  console.log("==========================================");

  // 1. Initial crash recovery for pending entries in PEL
  console.log("[Worker] Running initial pending messages recovery...");
  await recoverPendingMessages(consumerName);

  // 2. Schedule periodic recovery for stuck messages (every 30s)
  recoveryInterval = setInterval(async () => {
    await recoverPendingMessages(consumerName);
  }, 30000);

  // 3. Start stream consumption loop
  await consumer.start();
}

async function shutdown() {
  console.log("\n[Worker] Received shutdown signal. Cleaning up...");
  if (recoveryInterval) clearInterval(recoveryInterval);
  consumer.stop();

  try {
    await redis.quit();
    await pool.end();
    console.log("[Worker] Connections closed cleanly. Goodbye!");
    process.exit(0);
  } catch (err) {
    console.error("[Worker] Error during clean shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startWorker().catch((err) => {
  console.error("[Worker] Fatal error starting worker:", err);
  process.exit(1);
});
