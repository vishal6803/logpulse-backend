import pool from "../config/db";

const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/v1/ingest`;

const sampleErrors = [
  {
    type: "TypeError",
    level: "error",
    message: "TypeError: Cannot read properties of null (reading 'user_profile')",
    stack_trace: `TypeError: Cannot read properties of null (reading 'user_profile')
    at getUserProfile (/app/src/features/users/user.service.ts:112:25)
    at getDashboard (/app/src/features/dashboard/dashboard.controller.ts:44:18)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:149:13)`,
    metadata: {
      route: "/api/v1/users/profile",
      browser: "Chrome 146.0.0.0 (Windows 11)",
      os: "Windows 11",
      ip: "103.21.244.1",
    },
  },
  {
    type: "DatabaseError",
    level: "fatal",
    message: "ConnectionTimeoutError: Client pool timed out waiting for available connection",
    stack_trace: `ConnectionTimeoutError: Client pool timed out waiting for available connection
    at Pool.connect (/app/node_modules/pg-pool/index.js:210:14)
    at queryWithRetry (/app/src/config/db.ts:45:22)
    at fetchOrders (/app/src/services/order.service.ts:33:9)`,
    metadata: {
      activeConnections: 20,
      idleTimeout: 30000,
      host: "ep-divine-darkness-a1hv5sh3-pooler.ap-southeast-1.aws.neon.tech",
    },
  },
  {
    type: "NetworkError",
    level: "error",
    message: "AxiosError: Request failed with status code 502 Bad Gateway",
    stack_trace: `AxiosError: Request failed with status code 502 Bad Gateway
    at createError (/app/node_modules/axios/lib/core/createError.js:16:15)
    at settle (/app/node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (/app/node_modules/axios/lib/adapters/http.js:324:11)`,
    metadata: {
      targetUrl: "https://auth.internal.corp/oauth/token",
      latencyMs: 1420,
      status: 502,
    },
  },
];

async function main() {
  console.log("==================================================================");
  console.log("   🚀 LogPulse: Ingesting Real-Time Error Event via Hot-Path");
  console.log("==================================================================\n");

  try {
    // 1. Get an active project with api_key
    const projectRes = await pool.query(
      "SELECT id, name, api_key FROM projects WHERE api_key IS NOT NULL LIMIT 1"
    );

    if (projectRes.rows.length === 0) {
      console.error("❌ No project with API key found in database.");
      process.exit(1);
    }

    const project = projectRes.rows[0];
    const apiKey = project.api_key;
    const randomError = sampleErrors[Math.floor(Math.random() * sampleErrors.length)];

    console.log(`📌 Target Project: "${project.name}" (ID: ${project.id})`);
    console.log(`🔑 Using API Key: ${apiKey}`);
    console.log(`⚡ Sending Ingestion Request to: ${API_URL}`);
    console.log(`💥 Error Payload: ${randomError.message}\n`);

    const payload = {
      environmentName: "Production",
      type: randomError.type,
      level: randomError.level,
      message: randomError.message,
      stack_trace: randomError.stack_trace,
      metadata: randomError.metadata,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.status === 202) {
      console.log("✅ INGESTION SUCCESSFUL (HTTP 202 Accepted)!");
      console.log(`   - Stream Event ID: ${result.eventId}`);
      console.log(`   - Queue: logpulse:events:stream (Zero DB Hit Hot-Path)`);
      console.log("\n💡 NEXT STEP: If your worker is running (`pnpm worker`),");
      console.log("   it will instantly consume this stream and persist it to PostgreSQL.");
      console.log("   Then check your dashboard at: http://localhost:4000/issues\n");
    } else {
      console.error(`❌ Ingestion failed with status ${response.status}:`, result);
    }
  } catch (err: any) {
    if (err.cause?.code === "ECONNREFUSED") {
      console.error(`❌ Connection refused at ${API_URL}. Is your server running?`);
      console.log("👉 Start server first with: pnpm dev");
    } else {
      console.error("❌ Error sending event:", err.message || err);
    }
  } finally {
    await pool.end();
  }
}

main();
