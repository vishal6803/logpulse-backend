import { v4 as uuidv4 } from "uuid";
import pool from "../src/config/db";
import { getAIAnalyzer } from "../src/features/ai/ai.provider";
import {
  analyzeErrorGroupService,
  getCachedAnalysisService,
} from "../src/features/ai/ai.service";
import {
  AIAnalysisResult,
  AIAnalysisResultSchema,
  AIErrorContext,
} from "../src/features/ai/ai.types";
import {
  buildSystemPrompt,
  buildUserPrompt,
  pruneMetadata,
  sanitizeStackTrace,
} from "../src/features/ai/prompt.builder";

async function runTests() {
  console.log("====================================================");
  console.log("   🧪 LogPulse Phase 3: AI Engine Verification Tests");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Stack Trace Sanitization & Trimming
    // -------------------------------------------------------------
    const rawTrace = `Error: DB Connection Failed
      at connect (/app/db.ts:12:5)
      at init (/app/index.ts:40:10)
      at node:internal/process/task_queues:95:5
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at webpack/bootstrap:1:1
      at frame6 (/app/a.ts:1:1)
      at frame7 (/app/b.ts:1:1)
      at frame8 (/app/c.ts:1:1)
      at frame9 (/app/d.ts:1:1)
      at frame10 (/app/e.ts:1:1)
      at frame11 (/app/f.ts:1:1)
      at frame12 (/app/g.ts:1:1)
      at frame13 (/app/h.ts:1:1)
      at frame14 (/app/i.ts:1:1)`;

    const sanitized = sanitizeStackTrace(rawTrace, 5);
    assert(
      !sanitized.includes("webpack/bootstrap") &&
        sanitized.includes("truncated"),
      "sanitizeStackTrace filters node runtime noise and truncates excess frames"
    );

    // -------------------------------------------------------------
    // Test 2: Metadata Pruning & Security Redaction
    // -------------------------------------------------------------
    const dirtyMetadata = {
      browser: "Chrome 120",
      authorization: "Bearer secret-token-12345",
      password: "my-super-secret-password",
      url: "https://app.logpulse.io/dashboard",
      hugePayload: "x".repeat(1000),
    };

    const cleanMeta = pruneMetadata(dirtyMetadata);
    assert(
      cleanMeta.authorization === "[REDACTED]" &&
        cleanMeta.password === "[REDACTED]" &&
        cleanMeta.hugePayload.includes("[truncated]") &&
        cleanMeta.browser === "Chrome 120",
      "pruneMetadata redacts sensitive headers/credentials and truncates large payloads"
    );

    // -------------------------------------------------------------
    // Test 3: Structured Schema Validation (Zod)
    // -------------------------------------------------------------
    const validResult: AIAnalysisResult = {
      summary: "Null pointer exception when reading user profile in checkout",
      rootCause: "Unchecked dereference of req.user.address on guest checkout",
      suspectedFile: "src/services/checkout.ts",
      fixSuggestion: "Use optional chaining `req.user?.address` or validate guest status",
      confidence: "high",
    };

    const parsed = AIAnalysisResultSchema.safeParse(validResult);
    assert(parsed.success === true, "AIAnalysisResultSchema validates compliant JSON");

    const invalidResult = {
      summary: "Missing fields",
      // missing rootCause, fixSuggestion, confidence
    };
    const invalidParsed = AIAnalysisResultSchema.safeParse(invalidResult);
    assert(invalidParsed.success === false, "AIAnalysisResultSchema rejects incomplete JSON");

    // -------------------------------------------------------------
    // Test 4: Provider Resolver Pluggability (Zero classes)
    // -------------------------------------------------------------
    process.env.AI_PROVIDER = "gemini";
    const geminiAnalyzer = getAIAnalyzer();
    assert(typeof geminiAnalyzer === "function", "getAIAnalyzer returns a function for gemini");

    process.env.AI_PROVIDER = "openai";
    const openAIAnalyzer = getAIAnalyzer();
    assert(typeof openAIAnalyzer === "function", "getAIAnalyzer returns a function for openai");

    // -------------------------------------------------------------
    // Test 5: End-to-End DB Caching & Idempotency Test
    // -------------------------------------------------------------
    console.log("\n--- Testing Database Caching & Persistence Lifecycle ---");

    // Get an existing project & environment to link our test error group
    const projectRes = await pool.query("SELECT id FROM projects LIMIT 1");
    if (projectRes.rows.length === 0) {
      console.log("⚠️ No project found to test DB caching. Skipping DB lifecycle test.");
    } else {
      const projectId = projectRes.rows[0].id;
      const envRes = await pool.query("SELECT id FROM environments WHERE project_id = $1 LIMIT 1", [projectId]);
      const envId = envRes.rows[0]?.id;

      const testFingerprint = `test_fp_${Date.now()}_${uuidv4().substring(0, 8)}`;
      const testGroupId = uuidv4();

      // Insert dummy error group without AI analysis
      await pool.query(
        `INSERT INTO error_groups (id, project_id, environment_id, fingerprint, message, occurrence_count, first_seen, last_seen, status)
         VALUES ($1, $2, $3, $4, $5, 10, NOW(), NOW(), 'unresolved')`,
        [testGroupId, projectId, envId, testFingerprint, "TypeError: Cannot read properties of undefined (reading 'paymentMethod')"]
      );

      // Insert sample events
      await pool.query(
        `INSERT INTO events (id, project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata, created_at)
         VALUES 
         ($1, $2, $3, $4, 'TypeError', 'error', 'Payment method missing', 'at processOrder (/app/order.ts:50)', '{"env":"test"}', NOW() - INTERVAL '5 minutes'),
         ($5, $2, $3, $4, 'TypeError', 'error', 'Payment method missing', 'at processOrder (/app/order.ts:50)', '{"env":"test"}', NOW())`,
        [uuidv4(), projectId, envId, testGroupId, uuidv4()]
      );

      // Test getCachedAnalysisService before any analysis
      const preAnalysis = await getCachedAnalysisService(testGroupId);
      assert(preAnalysis === null, "getCachedAnalysisService returns null when not yet analyzed");

      // Populate mock AI analysis directly into the DB to test cache hit semantics
      const mockSummary = "Failed payment processing due to undefined paymentMethod on checkout";
      const mockFix = "Add null-check `order.paymentMethod?.id` before charging card";
      await pool.query(
        `UPDATE error_groups 
         SET ai_summary = $1, ai_root_cause = 'Missing payload field', ai_fix_suggestion = $2, ai_confidence = 'high', ai_analyzed_at = NOW()
         WHERE id = $3`,
        [mockSummary, mockFix, testGroupId]
      );

      // Step A: Request analysis (Should HIT DB CACHE in < 10ms, returning cached: true)
      const t0 = Date.now();
      const cachedResult = await analyzeErrorGroupService(testGroupId, { force: false });
      const elapsedMs = Date.now() - t0;

      assert(
        cachedResult.cached === true && cachedResult.summary === mockSummary,
        `analyzeErrorGroupService returns from DB cache in ${elapsedMs}ms with cached: true`
      );

      // Step B: Direct cached fetch
      const directFetch = await getCachedAnalysisService(testGroupId);
      assert(
        directFetch !== null && directFetch.summary === mockSummary,
        "getCachedAnalysisService retrieves stored analysis correctly"
      );

      // Clean up test error group and events
      await pool.query("DELETE FROM events WHERE error_group_id = $1", [testGroupId]);
      await pool.query("DELETE FROM error_groups WHERE id = $1", [testGroupId]);
      console.log("🧹 Cleaned up temporary test error group and events from DB");
    }

    await pool.end();

    console.log("\n====================================================");
    console.log(`   🏁 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("====================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution threw unexpected error:", err);
    await pool.end();
    process.exit(1);
  }
}

runTests();
