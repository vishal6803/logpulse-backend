import { v4 as uuidv4 } from "uuid";
import pool from "../config/db";

export const seedSampleIssues = async () => {
  console.log("🌱 Checking database for existing error groups...");

  const existingRes = await pool.query("SELECT count(*) FROM error_groups");
  const count = parseInt(existingRes.rows[0].count, 10);

  if (count > 0) {
    console.log(`ℹ️ Database already has ${count} error groups. Skipping seed.`);
    return;
  }

  console.log("🚀 Seeding realistic error groups and events for dashboard...");

  const projectsRes = await pool.query(
    "SELECT p.id as project_id, p.name as project_name, e.id as environment_id FROM projects p LEFT JOIN environments e ON p.id = e.project_id LIMIT 3"
  );

  if (projectsRes.rows.length === 0) {
    console.log("⚠️ No projects found to seed issues into.");
    return;
  }

  const p1 = projectsRes.rows[0];
  const p2 = projectsRes.rows[1] || p1;
  const p3 = projectsRes.rows[2] || p1;

  // Issue 1: Stripe Webhook TypeError (Unanalyzed - Ready for user to trigger AI!)
  const group1Id = uuidv4();
  await pool.query(
    `INSERT INTO error_groups (id, project_id, environment_id, fingerprint, message, occurrence_count, first_seen, last_seen, status)
     VALUES ($1, $2, $3, $4, $5, 142, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 minutes', 'unresolved')`,
    [
      group1Id,
      p1.project_id,
      p1.environment_id,
      "billing_pricing_tier_null_deref",
      "TypeError: Cannot read properties of undefined (reading 'pricingTier')",
    ]
  );

  await pool.query(
    `INSERT INTO events (id, project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'TypeError', 'error', 'Cannot read properties of undefined (reading ''pricingTier'')', $5, $6, NOW() - INTERVAL '2 minutes')`,
    [
      uuidv4(),
      p1.project_id,
      p1.environment_id,
      group1Id,
      `TypeError: Cannot read properties of undefined (reading 'pricingTier')
    at calculateBilling (/app/src/services/billing.service.ts:84:32)
    at handleInvoicePayment (/app/src/controllers/webhook.controller.ts:42:15)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:149:13)`,
      JSON.stringify({
        url: "https://api.logpulse.io/v1/stripe/webhook",
        method: "POST",
        event: "invoice.payment_succeeded",
        customer_id: "cus_987654321",
        browser: "Node.js v22.21.0 / Axios",
        os: "Linux Ubuntu 24.04 LTS",
        ip: "54.214.99.12",
      }),
    ]
  );

  // Issue 2: Zod Schema Validation Failure (Unanalyzed)
  const group2Id = uuidv4();
  await pool.query(
    `INSERT INTO error_groups (id, project_id, environment_id, fingerprint, message, occurrence_count, first_seen, last_seen, status)
     VALUES ($1, $2, $3, $4, $5, 38, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '14 minutes', 'unresolved')`,
    [
      group2Id,
      p2.project_id,
      p2.environment_id,
      "zod_validation_auth_register_email",
      "ZodError: Expected string, received null for field 'email'",
    ]
  );

  await pool.query(
    `INSERT INTO events (id, project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'ZodError', 'error', 'Validation failed for registration payload', $5, $6, NOW() - INTERVAL '14 minutes')`,
    [
      uuidv4(),
      p2.project_id,
      p2.environment_id,
      group2Id,
      `ZodError: [ { "code": "invalid_type", "expected": "string", "received": "null", "path": ["email"], "message": "Expected string, received null" } ]
    at validate (/app/src/middlewares/validate.middleware.ts:28:19)
    at registerUser (/app/src/features/auth/auth.controller.ts:18:11)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
      JSON.stringify({
        url: "https://app.logpulse.io/api/v1/auth/register",
        method: "POST",
        browser: "Chrome 146.0.0.0",
        os: "Windows 11 x64",
        ip: "103.21.244.1",
      }),
    ]
  );

  // Issue 3: React ChunkLoadError (Already Pre-Analyzed to test Cached View!)
  const group3Id = uuidv4();
  await pool.query(
    `INSERT INTO error_groups (
       id, project_id, environment_id, fingerprint, message, occurrence_count, first_seen, last_seen, status,
       ai_summary, ai_root_cause, ai_fix_suggestion, ai_confidence, ai_analyzed_at
     ) VALUES (
       $1, $2, $3, $4, $5, 1205, NOW() - INTERVAL '1 day', NOW() - INTERVAL '40 minutes', 'unresolved',
       $6, $7, $8, 'high', NOW() - INTERVAL '15 minutes'
     )`,
    [
      group3Id,
      p3.project_id,
      p3.environment_id,
      "chunk_load_error_849_timeout",
      "ChunkLoadError: Loading chunk 849 failed (timeout after 10000ms)",
      "Dynamic import bundle failed to load due to aggressive asset caching during rolling deployment.",
      "The client browser is requesting an old chunk hash that was purged from the CDN following a new production release.",
      "Implement a retry strategy for dynamic imports or add a `window.addEventListener('vite:preloadError')` / Next.js chunk error listener to auto-reload the page upon chunk failure:\n\n```typescript\n// Auto-reload on stale chunk\nwindow.addEventListener('error', (e) => {\n  if (/Loading chunk [0-9]+ failed/.test(e.message)) {\n    window.location.reload();\n  }\n});\n```",
    ]
  );

  await pool.query(
    `INSERT INTO events (id, project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'ChunkLoadError', 'error', 'Loading chunk 849 failed', $5, $6, NOW() - INTERVAL '40 minutes')`,
    [
      uuidv4(),
      p3.project_id,
      p3.environment_id,
      group3Id,
      `ChunkLoadError: Loading chunk 849 failed.
    at webpack/runtime/load script:25:1
    at HTMLScriptElement.onScriptComplete (webpack/runtime/jsonp chunk loading:52:1)`,
      JSON.stringify({
        url: "https://shop.logpulse.io/checkout",
        browser: "Safari 18.2 / iPhone 16",
        os: "iOS 18.2",
        ip: "172.56.21.89",
      }),
    ]
  );

  console.log("✅ Seed completed successfully! Seeded 3 error groups with event samples.");
};

if (require.main === module) {
  seedSampleIssues()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
    });
}
