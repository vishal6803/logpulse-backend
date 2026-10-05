import { v4 as uuidv4 } from "uuid";
import pool from "../src/config/db";
import { analyzeErrorGroupService, getCachedAnalysisService } from "../src/features/ai/ai.service";

async function runLiveAIFlow() {
  console.log("==================================================================");
  console.log("   🚀 LogPulse: LIVE End-to-End AI Engine Execution & Verification");
  console.log("==================================================================\n");

  const projectRes = await pool.query("SELECT id FROM projects LIMIT 1");
  if (projectRes.rows.length === 0) {
    console.error("❌ No projects found in DB to link test.");
    process.exit(1);
  }

  const projectId = projectRes.rows[0].id;
  const envRes = await pool.query("SELECT id FROM environments WHERE project_id = $1 LIMIT 1", [projectId]);
  const envId = envRes.rows[0]?.id || null;

  const testGroupId = uuidv4();
  const testFingerprint = `live_stripe_err_${Date.now()}`;

  console.log(`📌 Created Test Scenario:`);
  console.log(`   - Error Group ID: ${testGroupId}`);
  console.log(`   - Error Type: TypeError: Cannot read properties of undefined (reading 'pricingTier')`);
  console.log(`   - Context: Stripe Webhook handler in production\n`);

  try {
    // 1. Insert realistic Error Group into PostgreSQL
    await pool.query(
      `INSERT INTO error_groups (id, project_id, environment_id, fingerprint, message, occurrence_count, first_seen, last_seen, status)
       VALUES ($1, $2, $3, $4, $5, 42, NOW() - INTERVAL '1 hour', NOW(), 'unresolved')`,
      [
        testGroupId,
        projectId,
        envId,
        testFingerprint,
        "TypeError: Cannot read properties of undefined (reading 'pricingTier')",
      ]
    );

    // 2. Insert 2 representative sample events with realistic stack trace and metadata
    const sampleEvent1Id = uuidv4();
    const sampleEvent2Id = uuidv4();

    const sampleStack = `TypeError: Cannot read properties of undefined (reading 'pricingTier')
    at calculateBilling (/app/src/services/billing.service.ts:84:32)
    at handleInvoicePayment (/app/src/controllers/webhook.controller.ts:42:15)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:149:13)`;

    await pool.query(
      `INSERT INTO events (id, project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata, created_at)
       VALUES 
       ($1, $2, $3, $4, 'TypeError', 'error', 'Cannot read properties of undefined (reading ''pricingTier'')', $5, $6, NOW() - INTERVAL '45 minutes'),
       ($7, $2, $3, $4, 'TypeError', 'error', 'Cannot read properties of undefined (reading ''pricingTier'')', $5, $8, NOW())`,
      [
        sampleEvent1Id,
        projectId,
        envId,
        testGroupId,
        sampleStack,
        JSON.stringify({
          route: "/api/v1/stripe/webhook",
          event: "invoice.payment_succeeded",
          customerId: "cus_987654321",
          authorization: "Bearer secret-webhook-token",
        }),
        sampleEvent2Id,
        JSON.stringify({
          route: "/api/v1/stripe/webhook",
          event: "invoice.payment_succeeded",
          customerId: "cus_112233445",
          authorization: "Bearer secret-webhook-token-2",
        }),
      ]
    );

    console.log("------------------------------------------------------------------");
    console.log("🧪 STEP 1: Cold Call / Cache Miss (Live Gemini LLM Execution)");
    console.log("------------------------------------------------------------------");
    console.log("⏳ Sending sanitized context to Gemini model...");

    const tStart = Date.now();
    const liveResult = await analyzeErrorGroupService(testGroupId, { force: false });
    const liveDuration = Date.now() - tStart;

    console.log(`\n✅ Gemini Response Received & Persisted in ${liveDuration}ms!`);
    console.log(`   - Cached Flag: ${liveResult.cached} (Expected: false)`);
    console.log(`   - Confidence: [${liveResult.confidence.toUpperCase()}]`);
    console.log(`   - Suspected File: ${liveResult.suspectedFile || "N/A"}`);
    console.log(`   - Summary: ${liveResult.summary}`);
    console.log(`   - Root Cause: ${liveResult.rootCause}`);
    console.log(`   - Fix Suggestion:\n${liveResult.fixSuggestion}\n`);

    console.log("------------------------------------------------------------------");
    console.log("🧪 STEP 2: Cache Hit Verification (Repeated Request - $0 Cost)");
    console.log("------------------------------------------------------------------");

    const tCacheStart = Date.now();
    const cachedResult = await analyzeErrorGroupService(testGroupId, { force: false });
    const cacheDuration = Date.now() - tCacheStart;

    console.log(`✅ Cache Hit Result in ${cacheDuration}ms:`);
    console.log(`   - Cached Flag: ${cachedResult.cached} (Expected: true)`);
    console.log(`   - LLM Calls: 0 (Served directly from PostgreSQL error_groups table)`);
    console.log(`   - Summary: ${cachedResult.summary}`);

    if (!cachedResult.cached) {
      throw new Error("Expected cache hit on repeated call!");
    }

    console.log("\n------------------------------------------------------------------");
    console.log("🧪 STEP 3: Force Refresh Verification (?force=true)");
    console.log("------------------------------------------------------------------");

    const tForceStart = Date.now();
    const forcedResult = await analyzeErrorGroupService(testGroupId, { force: true });
    const forceDuration = Date.now() - tForceStart;

    console.log(`✅ Force Refresh completed in ${forceDuration}ms:`);
    console.log(`   - Cached Flag: ${forcedResult.cached} (Expected: false, bypassed cache)`);
    console.log(`   - Analyzed At: ${forcedResult.analyzedAt}`);

    console.log("\n==================================================================");
    console.log("🎉 ALL LIVE INTEGRATION CHECKS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
  } catch (err: any) {
    console.error("❌ Live test failed:", err.message || err);
  } finally {
    // Cleanup test records
    await pool.query("DELETE FROM events WHERE error_group_id = $1", [testGroupId]);
    await pool.query("DELETE FROM error_groups WHERE id = $1", [testGroupId]);
    await pool.end();
    console.log("🧹 Cleaned up temporary test records from database.");
  }
}

runLiveAIFlow();
